import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getLessonsByCourse(courseSlug: string) {
  // Bước 1: Tìm xem cái slug 'html-css' là ID số mấy?
  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', courseSlug)
    .single();

  if (!course) return [];

  // Bước 2: Lấy các bài học thuộc ID đó
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, slug')
    .eq('course_id', course.id) // Lọc theo khóa học
    .order('id', { ascending: true });

  return lessons || [];
}

export async function getExerciseByLesson(lessonSlug: string){
  const { data: lesson} = await supabase
    .from('lessons')
    .select('id')
    .eq('slug', lessonSlug)
    .single();

  if(!lesson) return null;

  const { data: exercises, error} = await supabase
    .from('exercises')
    .select('*')
    .eq('lesson_id', lesson.id)
    .order('id', { ascending: true });

  if(error){
    alert(error.message);
    return null;
  }

  return {
    lesson,
    exercises: exercises || []
  };
}

export async function saveUserProgress(userId: string, lessonId: number){
  const { error } = await supabase
    .from('user_progress')
    .insert({user_id: userId, lesson_id: lessonId});

  if (error && error.code !== '23505')
    alert('Lỗi lưu tiến độ' + error.message)
}

export async function getCompletedLessonIds(userId: string) {
  const { data } = await supabase
    .from ('user_progress')
    .select('lesson_id')
    .eq('user_id', userId)

  if(!data) return [];
  return data.map(item => item.lesson_id)
}