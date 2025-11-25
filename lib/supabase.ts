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
