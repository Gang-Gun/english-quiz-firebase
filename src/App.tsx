import { useEffect, useMemo, useState } from "react";
import { classId, rankings as fallbackRankings, scores as fallbackScores, settings as fallbackSettings, words } from "./demoData";
import { calculateWrongWordProgress } from "./domain/quiz";
import type { ClassSettings, RankingRow, ScoreRecord, Student } from "./domain/types";
import { adminGetDashboard, adminUpdateSettings, getStudentDashboard, studentLogin } from "./firebase/contracts";
import { hasFirebaseConfig } from "./firebase/config";
import "./styles.css";

type Page = "student" | "admin";
type StudentView = "login" | "dashboard" | "quiz" | "result";
type Period = "day" | "week" | "month" | "all";

interface DashboardData {
  settings: ClassSettings;
  scores: ScoreRecord[];
  rankings: RankingRow[];
}

const defaultDashboard: DashboardData = {
  settings: fallbackSettings,
  scores: fallbackScores,
  rankings: fallbackRankings
};

const adminAccessCode = import.meta.env.VITE_ADMIN_ACCESS_CODE || "1223";

const periodLabels: Record<Period, string> = {
  day: "오늘",
  week: "7일",
  month: "30일",
  all: "전체"
};

function initialPage(): Page {
  if (typeof window === "undefined") return "student";
  return window.location.hash === "#admin" ? "admin" : "student";
}

function percentFor(score?: number) {
  return `${score ?? 0}%`;
}

function getRank(rankings: RankingRow[], studentId: string) {
  const row = rankings.find((item) => item.studentId === studentId);
  return row ? `${row.rank}등` : "-";
}

function StudentPage({
  data,
  onAdmin,
  onRefresh
}: {
  data: DashboardData;
  onAdmin: () => void;
  onRefresh: (studentId?: string) => Promise<void>;
}) {
  const [view, setView] = useState<StudentView>("login");
  const [studentId, setStudentId] = useState(() => localStorage.getItem("voca_student_id") || "20401");
  const [student, setStudent] = useState<Student | null>(null);
  const [period, setPeriod] = useState<Period>("day");
  const [busy, setBusy] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [resultScore, setResultScore] = useState<number | null>(null);
  const [quizWords, setQuizWords] = useState<string[]>([]);

  const latest = student ? data.scores.find((score) => score.studentId === student.id) : undefined;
  const wrongWords = useMemo(() => (student ? calculateWrongWordProgress(student.id, data.scores) : []), [data.scores, student]);

  const login = async (isAuto = false) => {
    const id = studentId.trim();
    if (!id) return;

    if (id === adminAccessCode) {
      sessionStorage.setItem("voca_admin_code", id);
      setStudentId("");
      onAdmin();
      return;
    }

    if (!isAuto) setBusy(true);
    try {
      const result = await studentLogin({ classId, studentId: id });
      if (!result || typeof result !== "object" || !("ok" in result) || !result.ok || !("student" in result)) {
        alert("미등록 학번입니다.");
        localStorage.removeItem("voca_student_id");
        return;
      }
      localStorage.setItem("voca_student_id", id);
      setStudent(result.student as Student);
      setPeriod("day");
      setView("dashboard");
      void onRefresh(id);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const cachedId = localStorage.getItem("voca_student_id");
    if (cachedId && view === "login") void login(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    if (!confirm("로그아웃 하시겠습니까?")) return;
    localStorage.removeItem("voca_student_id");
    setStudent(null);
    setStudentId("");
    setView("login");
  };

  const manualRefresh = () => {
    void onRefresh(student?.id);
  };

  const startQuiz = (isReview: boolean) => {
    if (isReview && wrongWords.length === 0) {
      alert("복습할 오답이 없습니다!");
      return;
    }
    if (data.settings.examStatus === "OFF") {
      alert("시험 가능 시간이 아닙니다.");
      return;
    }
    setQuizWords(isReview ? wrongWords : words.slice(0, data.settings.wordCount).map((word) => word.english));
    setReviewMode(isReview);
    setResultScore(null);
    setView("quiz");
  };

  const finishQuiz = () => {
    setResultScore(reviewMode ? 100 : latest?.score ?? 93);
    setView("result");
  };

  const backToDash = () => {
    setView("dashboard");
  };

  return (
    <div className="container px-3 student-container">
      <div className="d-flex justify-content-between mb-3 px-1 top-actions">
        <button className="btn btn-sm btn-light border text-muted top-btn" onClick={logout} style={{ display: view === "login" ? "none" : "inline-block" }}>
          로그아웃
        </button>
        <button className="btn btn-sm btn-light border text-muted top-btn ms-auto" onClick={manualRefresh}>
          새로고침
        </button>
      </div>

      {view === "login" && (
        <div id="loginSection" className="text-center">
          <h2 className="fw-bold mb-4 mt-4 text-primary">단어 학습</h2>
          <div className="card p-4">
            <input
              type="text"
              id="studentId"
              className="form-control mb-3 text-center py-3 border-0 bg-light shadow-none"
              placeholder="학번 입력"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void login();
              }}
            />
            <button className="btn btn-primary btn-custom w-100" id="loginBtn" onClick={() => void login()} disabled={busy}>
              {busy ? "로그인 중..." : "로그인"}
            </button>
          </div>
        </div>
      )}

      {view === "dashboard" && student && (
        <div id="dashboardSection">
          <div className="text-center mb-3">
            <h4 className="fw-bold">
              <span id="displayName">{student.name}</span> 학생
            </h4>
          </div>

          <div className="card p-3 text-center">
            <div className="btn-group mb-3 w-100">
              {(Object.keys(periodLabels) as Period[]).map((key) => (
                <button
                  key={key}
                  id={`periodBtn-${key}`}
                  className={`btn btn-sm ${period === key ? "btn-secondary" : "btn-outline-secondary"}`}
                  onClick={() => setPeriod(key)}
                >
                  {periodLabels[key]}
                </button>
              ))}
            </div>
            <div className="row align-items-center">
              <div className="col-6">
                <div className="avg-circle" id="avgScore">
                  {percentFor(latest?.score)}
                </div>
                <small className="text-muted">
                  <span className="periodText">{periodLabels[period]}</span> 정답률
                </small>
              </div>
              <div className="col-6">
                <div className="h3 fw-bold text-primary" id="myRank">
                  {getRank(data.rankings, student.id)}
                </div>
                <small className="text-muted">
                  <span className="periodText">{periodLabels[period]}</span> 등수
                </small>
              </div>
            </div>
          </div>

          <div className="card p-3 mb-3">
            <h6>오답 단어</h6>
            <div id="wrongWordsContainer">
              {wrongWords.length ? (
                wrongWords.map((word) => (
                  <span className="wrong-word" key={word}>
                    {word}
                  </span>
                ))
              ) : (
                <p className="text-muted small m-0">오답이 없습니다.</p>
              )}
            </div>
          </div>

          <div className="d-grid gap-2">
            <button className="btn btn-success btn-custom" id="regBtn" onClick={() => startQuiz(false)}>
              정규 시험 시작
            </button>
            <button className="btn btn-outline-danger btn-custom" id="reviewBtn" onClick={() => startQuiz(true)}>
              오답 재시험
            </button>
          </div>
        </div>
      )}

      {view === "quiz" && (
        <div id="quizSection">
          <div className="card p-4 shadow">
            <div className="text-end mb-2 small text-muted" id="qNumber">
              1 / {Math.min(data.settings.wordCount, 10)}
            </div>
            <h4 id="questionText" className="text-center fw-bold mb-5 py-3">
              {quizWords[0] ?? words[0].english}
            </h4>
            <div id="optionsArea" className="d-grid gap-2">
              {["제공하다", "개발하다", "알리다", "허락하다"].map((option) => (
                <button type="button" className="btn btn-outline-secondary p-3 border-2 mb-2 fw-medium option-btn" onClick={finishQuiz} key={option}>
                  {option}
                </button>
              ))}
            </div>
            <input
              type="text"
              id="subjectiveInput"
              className="form-control text-center mb-3 py-3 shadow-none border-light"
              placeholder="정답 입력"
              style={{ display: "none" }}
            />
            <button id="nextBtn" className="btn btn-primary btn-custom w-100" onClick={finishQuiz} style={{ display: "none" }}>
              다음
            </button>
          </div>
        </div>
      )}

      {view === "result" && (
        <div id="quizSection">
          <div className="card p-4 text-center border-0 shadow">
            <h6 className="text-muted mb-2">{reviewMode ? "오답 재시험 완료" : "정규시험 완료"}</h6>
            <h1 className="fw-bold mb-4 text-primary">{resultScore}점</h1>
            <button className="btn btn-primary btn-custom w-100 shadow-sm" onClick={backToDash}>
              대시보드로
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminPage({
  data,
  onSave,
  onStudent,
  onRefresh
}: {
  data: DashboardData;
  onSave: (patch: Partial<ClassSettings>) => Promise<void>;
  onStudent: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [period, setPeriod] = useState<Period>("day");
  const [quizCount, setQuizCount] = useState(data.settings.wordCount);
  const [refreshing, setRefreshing] = useState(false);
  const recent = data.scores.slice().sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());
  const reviewRows = data.scores.filter((score) => score.mode === "review");

  const updateStatus = async (isOn: boolean) => {
    await onSave({ examStatus: isOn ? "ON" : "OFF", wordCount: quizCount });
    alert("설정이 반영되었습니다.");
  };

  const refreshAdmin = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="admin-body">
      <div className="container admin-container">
        <div className="d-flex justify-content-between mb-3 align-items-center">
          <h4 className="fw-bold mb-0">학급 관리</h4>
          <div>
            <button className="btn btn-outline-success btn-sm me-1 admin-top-btn" onClick={onStudent}>
              학생 화면으로
            </button>
            <button className="btn btn-white btn-sm border text-muted admin-top-btn" onClick={() => void refreshAdmin()} disabled={refreshing}>
              {refreshing ? "새로고침 중..." : "새로고침"}
            </button>
          </div>
        </div>

        <div className="btn-group mb-3 w-100">
          {(Object.keys(periodLabels) as Period[]).map((key) => (
            <button
              key={key}
              id={`adminPeriodBtn-${key}`}
              className={`btn ${period === key ? "btn-primary text-white" : "btn-outline-primary"}`}
              onClick={() => setPeriod(key)}
            >
              {periodLabels[key]}
            </button>
          ))}
        </div>

        <div className="row">
          <div className="col-6">
            <div className="card stat-card p-3">
              <h6 className="fw-bold text-primary small mb-0">학습왕(정규 점수)</h6>
              <div className="rank-list-wrapper" id="studyRank">
                {data.rankings.map((row, index) => (
                  <div className="rank-item" key={row.studentId}>
                    <span>
                      <b>{index + 1}.</b> {row.studentName} {row.average}점
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="col-6">
            <div className="card stat-card p-3">
              <h6 className="fw-bold text-warning small mb-0">재시험현황(횟수)</h6>
              <div className="rank-list-wrapper" id="reviewRank">
                {reviewRows.length ? (
                  reviewRows.map((row, index) => (
                    <div className="rank-item" key={row.id}>
                      <span>
                        <b>{index + 1}.</b> {row.studentName} {row.score}점
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-muted small">데이터 없음</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card stat-card p-3">
          <div className="d-flex justify-content-between align-items-center admin-status-line">
            <div>
              <span className="small text-muted" id="prog">
                {data.settings.lastWordNumber}번 완료
              </span>
              <br />
              <b>
                상태: <span id="stat" className="text-primary">{data.settings.examStatus}</span>
              </b>
            </div>
            <div className="input-group admin-qcount">
              <input type="number" id="qCount" className="form-control form-control-sm" value={quizCount} onChange={(event) => setQuizCount(Number(event.target.value))} />
              <button className="btn btn-sm btn-primary" onClick={() => void updateStatus(true)}>
                ON
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => void updateStatus(false)}>
                OFF
              </button>
            </div>
          </div>
        </div>

        <div className="card stat-card p-3">
          <h6 className="fw-bold mb-2 small">
            <span id="pLabel">{periodLabels[period]}</span> 현황
          </h6>
          <div className="table-responsive admin-score-table">
            <table className="table table-sm table-borderless small mb-0">
              <tbody id="scoreTable">
                {recent.length ? (
                  recent.map((row) => (
                    <tr key={row.id}>
                      <td>{row.studentName}</td>
                      <td>
                        <b>{row.mode === "regular" ? "정규" : "오답"}</b>
                      </td>
                      <td>{row.score}점</td>
                      <td className="small text-muted">{new Date(row.takenAt).toLocaleDateString("ko-KR")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      데이터 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>(initialPage);
  const [data, setData] = useState<DashboardData>(defaultDashboard);

  const ensureAdminCode = () => {
    if (sessionStorage.getItem("voca_admin_code")) return true;
    const code = prompt("관리자 접속 코드를 입력하세요.");
    if (!code?.trim()) return false;
    if (code.trim() !== adminAccessCode) {
      alert("관리자 접속 코드를 확인하세요.");
      return false;
    }
    sessionStorage.setItem("voca_admin_code", code.trim());
    return true;
  };

  const refreshDashboard = async () => {
    try {
      const result = await adminGetDashboard({ classId });
      if (result && typeof result === "object") {
        setData((current) => ({ ...current, ...(result as Partial<DashboardData>) }));
      }
    } catch (error) {
      sessionStorage.removeItem("voca_admin_code");
      alert("관리자 접속 코드를 확인하세요.");
      window.location.hash = "student";
      setPage("student");
    }
  };

  const refreshStudentDashboard = async (studentId?: string) => {
    if (!studentId) return;
    try {
      const result = await getStudentDashboard({ classId, studentId });
      if (result && typeof result === "object") {
        setData((current) => ({ ...current, ...(result as Partial<DashboardData>) }));
      }
    } catch {
      alert("학생 데이터를 새로고침하지 못했습니다.");
    }
  };

  useEffect(() => {
    const syncHash = () => setPage(initialPage());
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    if (page !== "admin") return;
    if (!ensureAdminCode()) {
      window.location.hash = "student";
      setPage("student");
      return;
    }
    void refreshDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (!hasFirebaseConfig()) return undefined;
    let alive = true;
    refreshDashboard()
      .then((result) => {
        if (!alive) return;
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const openAdmin = () => {
    if (!ensureAdminCode()) return;
    window.location.hash = "admin";
    setPage("admin");
  };

  const openStudent = () => {
    window.location.hash = "student";
    setPage("student");
  };

  const saveSettings = async (patch: Partial<ClassSettings>) => {
    const result = await adminUpdateSettings({ classId, patch });
    const nextSettings =
      result && typeof result === "object" && "settings" in result ? (result.settings as ClassSettings) : { ...data.settings, ...patch };
    setData((current) => ({ ...current, settings: nextSettings }));
  };

  return page === "admin" ? (
    <AdminPage data={data} onSave={saveSettings} onStudent={openStudent} onRefresh={refreshDashboard} />
  ) : (
    <StudentPage data={data} onAdmin={openAdmin} onRefresh={refreshStudentDashboard} />
  );
}
