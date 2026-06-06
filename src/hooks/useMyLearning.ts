"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useUniversityStore } from "@/stores/university.store";
import {
  getMyCourses,
  getCourseDetail,
  getPlaybackSession,
  sendProgressTick,
  getLessonNote,
  saveLessonNote,
  getResourceUrl,
  completeLesson,
  type MyCourse,
  type CourseDetail,
  type LessonSummary,
  type PlaybackSession,
  type LessonProgressResponse,
  type LessonNote,
} from "@/services/university.service";

interface State {
  myCourses: MyCourse[];
  activeCourse: MyCourse | null;
  courseDetail: CourseDetail | null;
  activeLesson: LessonSummary | null;
  playbackSession: PlaybackSession | null;
  lessonProgress: Record<string, LessonProgressResponse>;
  note: LessonNote | null;
  isLoadingCourses: boolean;
  isLoadingDetail: boolean;
  isLoadingPlayback: boolean;
  isSavingNote: boolean;
  error: string | null;
}

export function useMyLearning() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const searchParams = useSearchParams();
  const targetCourseId = searchParams.get("courseId");
  const { setActiveCourse, clearActiveCourse } = useUniversityStore();

  const [state, setState] = useState<State>({
    myCourses: [],
    activeCourse: null,
    courseDetail: null,
    activeLesson: null,
    playbackSession: null,
    lessonProgress: {},
    note: null,
    isLoadingCourses: true,
    isLoadingDetail: false,
    isLoadingPlayback: false,
    isSavingNote: false,
    error: null,
  });

  // Progress tick refs — avoid stale closures in event handlers
  const watchedFromRef = useRef<number>(0);
  const lastTickAtRef = useRef<number>(0);
  const activeLessonRef = useRef<LessonSummary | null>(null);

  // Keep activeLessonRef in sync
  useEffect(() => {
    activeLessonRef.current = state.activeLesson;
  }, [state.activeLesson]);

  // ── Step 1: Load enrolled courses on mount ──────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    getMyCourses(1, 20)
      .then((res) => {
        if (cancelled) return;
        const courses = res.data;
        const active = (targetCourseId ? courses.find((c) => c.course.id === targetCourseId) : null) ?? courses[0] ?? null;
        setState((p) => ({
          ...p,
          myCourses: courses,
          activeCourse: active,
          isLoadingCourses: false,
        }));
      })
      .catch(() => {
        if (!cancelled)
          setState((p) => ({ ...p, isLoadingCourses: false, error: "Failed to load your courses" }));
      });

    return () => { cancelled = true; clearActiveCourse(); };
  }, [accessToken, targetCourseId, clearActiveCourse]);

  // ── Step 2: Load course detail when activeCourse changes ───────────────────
  useEffect(() => {
    if (!state.activeCourse) return;
    let cancelled = false;
    const courseId = state.activeCourse.course.id;

    setState((p) => ({ ...p, isLoadingDetail: true, courseDetail: null, activeLesson: null, playbackSession: null }));

    getCourseDetail(courseId)
      .then((detail) => {
        if (cancelled) return;

        // Pick the default lesson: lastPlayedLesson or first lesson of first module
        const lastId = state.activeCourse?.lastPlayedLesson?.id;
        let defaultLesson: LessonSummary | null = null;

        for (const mod of detail.modules) {
          for (const lesson of mod.lessons) {
            if (!defaultLesson) defaultLesson = lesson;
            if (lesson.id === lastId) { defaultLesson = lesson; break; }
          }
        }

        setActiveCourse(detail.title, detail.description ?? null);
        setState((p) => ({
          ...p,
          courseDetail: detail,
          activeLesson: defaultLesson,
          isLoadingDetail: false,
        }));
      })
      .catch(() => {
        if (!cancelled)
          setState((p) => ({ ...p, isLoadingDetail: false, error: "Failed to load course details" }));
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeCourse?.course.id]);

  // ── Step 3: Load playback session + note when activeLesson changes ──────────
  useEffect(() => {
    if (!state.activeLesson) return;
    let cancelled = false;
    const lesson = state.activeLesson;

    // Load note for any lesson type
    getLessonNote(lesson.id)
      .then((note) => { if (!cancelled) setState((p) => ({ ...p, note })); })
      .catch(() => {});

    // Load playback session only for READY VIDEO lessons
    if (lesson.lessonType === "VIDEO" && lesson.mediaAsset?.status === "READY") {
      setState((p) => ({ ...p, isLoadingPlayback: true, playbackSession: null }));
      console.log("[playback-session] requesting for lessonId:", lesson.id);
      getPlaybackSession(lesson.id)
        .then((session) => {
          console.log("[playback-session] success:", session);
          if (!cancelled) {
            setState((p) => ({ ...p, playbackSession: session, isLoadingPlayback: false }));
            watchedFromRef.current = session.lastPositionSeconds;
          }
        })
        .catch((err) => {
          console.error("[playback-session] error status:", err?.response?.status);
          console.error("[playback-session] error body:", err?.response?.data);
          console.error("[playback-session] full error:", err);
          if (!cancelled) setState((p) => ({ ...p, isLoadingPlayback: false }));
        });
    } else {
      setState((p) => ({ ...p, playbackSession: null, isLoadingPlayback: false }));
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeLesson?.id]);

  // ── Progress tick flush ─────────────────────────────────────────────────────
  const flushTick = useCallback((currentTime: number, duration: number) => {
    const lesson = activeLessonRef.current;
    if (!lesson || lesson.lessonType !== "VIDEO") return;

    const watchedFrom = watchedFromRef.current;
    const watchedTo = Math.min(currentTime, watchedFrom + 60); // max 60s per interval

    if (watchedTo <= watchedFrom) return;

    // Rate limit: skip if last tick was < 5s ago
    const now = Date.now();
    if (now - lastTickAtRef.current < 5000) return;
    lastTickAtRef.current = now;

    watchedFromRef.current = currentTime;

    sendProgressTick(lesson.id, { currentTime, duration, watchedFrom, watchedTo })
      .then((res) => {
        setState((p) => ({
          ...p,
          lessonProgress: { ...p.lessonProgress, [lesson.id]: res },
          activeCourse: p.activeCourse
            ? { ...p.activeCourse, myProgress: res.courseProgress }
            : null,
        }));
      })
      .catch(() => {}); // silent — ticks are best-effort
  }, []);

  // ── Player event handlers (passed to VideoPlayer) ───────────────────────────
  const onTimeUpdate = useCallback((currentTime: number, duration: number) => {
    if (currentTime - watchedFromRef.current >= 10) {
      flushTick(currentTime, duration);
    }
  }, [flushTick]);

  const onPause = useCallback((currentTime: number, duration: number) => {
    flushTick(currentTime, duration);
  }, [flushTick]);

  const onSeeked = useCallback((currentTime: number, duration: number) => {
    watchedFromRef.current = currentTime; // reset watched start on seek
    flushTick(currentTime, duration);
  }, [flushTick]);

  const onEnded = useCallback((duration: number) => {
    // Bypass rate limit for final flush on video end
    lastTickAtRef.current = 0;
    flushTick(duration, duration);

    // Only RESOURCE lessons use /complete — VIDEO completion is handled server-side via ticks
    const lesson = activeLessonRef.current;
    if (!lesson || lesson.lessonType !== "RESOURCE") return;
    completeLesson(lesson.id)
      .then((res) => {
        setState((p) => ({
          ...p,
          lessonProgress: { ...p.lessonProgress, [lesson.id]: res },
          activeCourse: p.activeCourse
            ? { ...p.activeCourse, myProgress: res.courseProgress }
            : null,
        }));
      })
      .catch(() => {});
  }, [flushTick]);

  // ── Select lesson ───────────────────────────────────────────────────────────
  const selectLesson = useCallback((lesson: LessonSummary) => {
    setState((p) => ({ ...p, activeLesson: lesson }));
    watchedFromRef.current = 0;
  }, []);

  // ── Select course ───────────────────────────────────────────────────────────
  const selectCourse = useCallback((course: MyCourse) => {
    setState((p) => ({ ...p, activeCourse: course }));
  }, []);

  // ── Save note ───────────────────────────────────────────────────────────────
  const saveNote = useCallback(async (content: string) => {
    if (!state.activeLesson) return;
    setState((p) => ({ ...p, isSavingNote: true }));
    try {
      const note = await saveLessonNote(state.activeLesson.id, content);
      setState((p) => ({ ...p, note, isSavingNote: false }));
    } catch {
      setState((p) => ({ ...p, isSavingNote: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeLesson?.id]);

  // ── Open resource ───────────────────────────────────────────────────────────
  const openResource = useCallback(async (lessonId: string, resourceId: string) => {
    const { url } = await getResourceUrl(lessonId, resourceId);
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  // ── Complete resource lesson ────────────────────────────────────────────────
  const completeResourceLesson = useCallback(async (lessonId: string) => {
    const res = await completeLesson(lessonId);
    setState((p) => ({
      ...p,
      lessonProgress: { ...p.lessonProgress, [lessonId]: res },
      activeCourse: p.activeCourse
        ? { ...p.activeCourse, myProgress: res.courseProgress }
        : null,
    }));
  }, []);

  return {
    ...state,
    selectLesson,
    selectCourse,
    saveNote,
    openResource,
    completeResourceLesson,
    onTimeUpdate,
    onPause,
    onSeeked,
    onEnded,
  };
}
