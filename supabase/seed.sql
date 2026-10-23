-- Local seed: invented data only. It runs after the migrations on `supabase db reset` and never touches hosted.
-- The passwords below are local test values: valid only against the local stack, never reused anywhere.

-- Users. The `on_auth_user_created` trigger creates the matching `profiles` rows from raw_user_meta_data.
-- GoTrue fails password sign-in with "converting NULL to string" when a token column is NULL, so those
-- columns are '' here. `confirmed_at` and the identities `email` column are generated and not written.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'learner@devspace.test',
    extensions.crypt('learner-local-pass-1', extensions.gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}', '{"full_name":"Nguyễn Văn Học"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'admin@devspace.test',
    extensions.crypt('admin-local-pass-1', extensions.gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}', '{"full_name":"Trần Thị Quản"}', now(), now()
  );

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  id::text, id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users
where email in ('learner@devspace.test', 'admin@devspace.test');

-- `handle_new_user` always writes role 'user'; this seed runs as `postgres`, which `prevent_role_escalation` allows.
update public.profiles set role = 'admin' where id = '22222222-2222-4222-8222-222222222222';

-- Courses: one free (price 0) and one paid, no instructor.
insert into public.courses (id, name, slug, description, price) values
  (1, 'Làm quen với HTML', 'lam-quen-voi-html', 'Khóa học miễn phí giới thiệu các thẻ HTML đầu tiên.', 0),
  (2, 'JavaScript căn bản', 'javascript-can-ban', 'Khóa học có phí về biến, hàm và vòng lặp trong JavaScript.', 199000);

insert into public.chapters (id, course_id, title, order_index) values
  (1, 1, 'Chương 1: Trang web đầu tiên', 1),
  (2, 2, 'Chương 1: Nền tảng JavaScript', 1);

insert into public.lessons (id, course_id, chapter_id, title, slug, order_index, content) values
  (1, 1, 1, 'Cấu trúc một trang HTML', 'cau-truc-mot-trang-html', 1, 'Một trang HTML gồm thẻ html, head và body.'),
  (2, 1, 1, 'Tiêu đề và đoạn văn', 'tieu-de-va-doan-van', 2, 'Dùng thẻ h1 cho tiêu đề và thẻ p cho đoạn văn.'),
  (3, 2, 2, 'Biến và kiểu dữ liệu', 'bien-va-kieu-du-lieu', 1, 'Khai báo biến bằng let và const.'),
  (4, 2, 2, 'Hàm và vòng lặp', 'ham-va-vong-lap', 2, 'Viết hàm với function và lặp bằng for.');

-- Explicit ids above, so move each identity sequence past them for later inserts.
select setval(pg_get_serial_sequence('public.courses', 'id'), (select max(id) from public.courses));
select setval(pg_get_serial_sequence('public.chapters', 'id'), (select max(id) from public.chapters));
select setval(pg_get_serial_sequence('public.lessons', 'id'), (select max(id) from public.lessons));

-- infrastructure U3 (D17): rows the RLS tests need. Invented; ids are explicit and above the ids used so far.

-- A third user, enrolled in the paid course. Same insert shape as the users above.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
  'authenticated', 'authenticated', 'student@devspace.test',
  extensions.crypt('student-local-pass-1', extensions.gen_salt('bf')), now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}', '{"full_name":"Lê Minh Học Viên"}', now(), now()
);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  id::text, id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users
where email = 'student@devspace.test';

-- enrollments, payments, notes, notifications and comments are GENERATED ALWAYS identity tables, so the
-- explicit ids need `overriding system value`; exercises and user_progress are BY DEFAULT.
insert into public.enrollments (id, user_id, course_id) overriding system value
  values (1, '33333333-3333-4333-8333-333333333333', 2);

insert into public.payments (id, user_id, course_id, amount, status) overriding system value
  values (1, '33333333-3333-4333-8333-333333333333', 2, 199000, 'approved');

insert into public.exercises (id, lesson_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation) values
  (1, 3, 'Từ khóa nào khai báo biến có thể gán lại?', 'let', 'const', 'fixed', 'static', 'A', 'let khai báo biến có thể gán lại giá trị.'),
  (2, 3, 'Từ khóa nào khai báo hằng số?', 'var', 'const', 'set', 'def', 'B', 'const khai báo biến không gán lại được.'),
  (3, 1, 'Thẻ nào bao quanh toàn bộ nội dung hiển thị của trang?', 'head', 'title', 'body', 'meta', 'C', 'Nội dung hiển thị nằm trong thẻ body.');

insert into public.coupons (id, code, discount_percent, max_uses, used_count, is_active) overriding system value
  values (1, 'LOCAL10', 10, 100, 0, true);

insert into public.notes (id, user_id, lesson_id, content, "timestamp") overriding system value
  values (1, '33333333-3333-4333-8333-333333333333', 3, 'Nhớ phân biệt let và const.', 0);

insert into public.user_progress (id, user_id, lesson_id)
  values (1, '33333333-3333-4333-8333-333333333333', 3);

insert into public.notifications (id, receiver_id, actor_id, title, message, type) overriding system value
  values (1, '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222',
          'Thanh toán đã được duyệt', 'Bạn đã có quyền học khóa JavaScript căn bản.', 'payment');

insert into public.comments (id, user_id, lesson_id, content) overriding system value
  values (1, '33333333-3333-4333-8333-333333333333', 3, 'Bài giảng này giải thích rất dễ hiểu.');

-- No seeded review: `reviews` is unique on (user_id, course_id), and the review tests insert their own.

select setval(pg_get_serial_sequence('public.enrollments', 'id'), (select max(id) from public.enrollments));
select setval(pg_get_serial_sequence('public.payments', 'id'), (select max(id) from public.payments));
select setval(pg_get_serial_sequence('public.exercises', 'id'), (select max(id) from public.exercises));
select setval(pg_get_serial_sequence('public.coupons', 'id'), (select max(id) from public.coupons));
select setval(pg_get_serial_sequence('public.notes', 'id'), (select max(id) from public.notes));
select setval(pg_get_serial_sequence('public.user_progress', 'id'), (select max(id) from public.user_progress));
select setval(pg_get_serial_sequence('public.notifications', 'id'), (select max(id) from public.notifications));
select setval(pg_get_serial_sequence('public.comments', 'id'), (select max(id) from public.comments));
