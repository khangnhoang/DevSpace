import { bigint, boolean, check, date, foreignKey, index, integer, pgSchema, pgTable, pgView, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const chapters = pgTable("chapters", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "chapters_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	courseId: bigint("course_id", { mode: "number" }).notNull(),
	title: text().notNull(),
	orderIndex: integer("order_index").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "chapters_course_id_fkey"
		}).onDelete("cascade"),
]);

export const comments = pgTable("comments", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "comments_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: uuid("user_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	lessonId: bigint("lesson_id", { mode: "number" }).notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	check("comments_content_check", sql`(char_length(TRIM(BOTH FROM content)) > 2) AND (char_length(content) < 1000)`),
	foreignKey({
			columns: [table.lessonId],
			foreignColumns: [lessons.id],
			name: "comments_lesson_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "comments_user_id_fkey"
		}).onDelete("cascade"),
	index("idx_comments_lesson_id").using("btree", table.lessonId.asc().nullsLast().op("int8_ops")),
]);

export const coupons = pgTable("coupons", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "coupons_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	code: text().notNull(),
	discountPercent: integer("discount_percent").notNull(),
	maxUses: integer("max_uses").default(100),
	usedCount: integer("used_count").default(0),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("coupons_code_key").on(table.code),
]);

export const courses = pgTable("courses", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "Courses_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807 }),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	imageUrl: text("image_url"),
	price: integer().default(0),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	instructorId: bigint("instructor_id", { mode: "number" }),
}, (table) => [
	foreignKey({
			columns: [table.instructorId],
			foreignColumns: [instructors.id],
			name: "courses_instructor_id_fkey"
		}),
	unique("Courses_id_key").on(table.id),
]);

export const enrollments = pgTable("enrollments", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "enrollments_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: uuid("user_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	courseId: bigint("course_id", { mode: "number" }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "enrollments_course_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "enrollments_user_id_fkey"
		}).onDelete("cascade"),
	unique("enrollments_user_course_unique").on(table.userId, table.courseId),
	unique("unique_enrollment").on(table.userId, table.courseId),
]);

export const exercises = pgTable("exercises", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "exercises_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	lessonId: bigint("lesson_id", { mode: "number" }).notNull(),
	question: text().notNull(),
	optionA: text("option_a").notNull(),
	optionB: text("option_b").notNull(),
	optionC: text("option_c").notNull(),
	optionD: text("option_d").notNull(),
	correctAnswer: text("correct_answer").notNull(),
	explanation: text(),
}, (table) => [
	foreignKey({
			columns: [table.lessonId],
			foreignColumns: [lessons.id],
			name: "exercises_lesson_id_fkey"
		}).onDelete("cascade"),
	unique("exercises_id_key").on(table.id),
]);

export const instructors = pgTable("instructors", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "instructors_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: uuid("user_id"),
	bio: text(),
	jobTitle: text("job_title"),
	website: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "instructors_user_id_fkey"
		}).onDelete("cascade"),
]);

export const lessons = pgTable("lessons", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "lessons_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	title: text().notNull(),
	slug: text().notNull(),
	content: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	courseId: bigint("course_id", { mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	chapterId: bigint("chapter_id", { mode: "number" }),
	videoUrl: text("video_url"),
	orderIndex: integer("order_index"),
	hasVideo: boolean("has_video").generatedAlwaysAs(sql`(COALESCE(video_url, ''::text) <> ''::text)`),
	wordCount: integer("word_count").generatedAlwaysAs(sql`
CASE
    WHEN (COALESCE(content, ''::text) = ''::text) THEN NULL::integer
    ELSE COALESCE(array_length(regexp_split_to_array(regexp_replace(regexp_replace(content, '<[^>]*>?'::text, ''::text, 'g'::text), '^[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$'::text, ''::text, 'g'::text), '[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+'::text), 1), 1)
END`),
}, (table) => [
	foreignKey({
			columns: [table.chapterId],
			foreignColumns: [chapters.id],
			name: "lessons_chapter_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "lessons_course_id_fkey"
		}).onDelete("cascade"),
	unique("lessons_id_key").on(table.id),
	unique("lessons_slug_key").on(table.slug),
]);

export const notes = pgTable("notes", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "notes_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: uuid("user_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	lessonId: bigint("lesson_id", { mode: "number" }).notNull(),
	content: text().notNull(),
	timestamp: integer().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.lessonId],
			foreignColumns: [lessons.id],
			name: "notes_lesson_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "notes_user_id_fkey"
		}).onDelete("cascade"),
]);

export const notifications = pgTable("notifications", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "notifications_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	receiverId: uuid("receiver_id").notNull(),
	actorId: uuid("actor_id"),
	title: text().notNull(),
	message: text(),
	link: text(),
	isRead: boolean("is_read").default(false),
	type: text(),
}, (table) => [
	check("notifications_type_check", sql`type = ANY (ARRAY['system'::text, 'comment'::text, 'payment'::text, 'course'::text, 'enrollment'::text])`),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [usersInAuth.id],
			name: "notifications_actor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.receiverId],
			foreignColumns: [usersInAuth.id],
			name: "notifications_receiver_id_fkey"
		}).onDelete("cascade"),
]);

export const payments = pgTable("payments", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "payments_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: uuid("user_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	courseId: bigint("course_id", { mode: "number" }).notNull(),
	amount: integer().default(0).notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	couponId: bigint("coupon_id", { mode: "number" }),
}, (table) => [
	foreignKey({
			columns: [table.couponId],
			foreignColumns: [coupons.id],
			name: "payments_coupon_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "payments_course_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "payments_user_id_fkey"
		}).onDelete("cascade"),
	uniqueIndex("payments_one_pending_per_user_course").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.courseId.asc().nullsLast().op("int8_ops")).where(sql`(status = 'pending'::text)`),
]);

export const profileCards = pgView("profile_cards", {	id: uuid(),
	fullName: text("full_name"),
	avatarUrl: text("avatar_url"),
	role: text(),
}).as(sql`SELECT id, full_name, avatar_url, role FROM profiles`);

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	email: text(),
	fullName: text("full_name"),
	avatarUrl: text("avatar_url"),
	role: text().default('user').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	gender: text(),
	dob: date(),
	province: text(),
	phone: text(),
}, (table) => [
	check("profiles_role_allowed", sql`role = ANY (ARRAY['user'::text, 'admin'::text])`),
	foreignKey({
			columns: [table.id],
			foreignColumns: [usersInAuth.id],
			name: "profiles_id_fkey"
		}).onDelete("cascade"),
]);

export const reviews = pgTable("reviews", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "reviews_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: uuid("user_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	courseId: bigint("course_id", { mode: "number" }),
	rating: integer(),
	content: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	check("reviews_rating_check", sql`(rating >= 1) AND (rating <= 5)`),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "reviews_course_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "reviews_user_id_fkey"
		}).onDelete("cascade"),
	unique("reviews_user_course_unique").on(table.userId, table.courseId),
]);

export const userProgress = pgTable("user_progress", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "user_progress_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	userId: uuid("user_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	lessonId: bigint("lesson_id", { mode: "number" }).notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.lessonId],
			foreignColumns: [lessons.id],
			name: "user_progress_lesson_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "user_progress_user_id_fkey"
		}).onDelete("cascade"),
	unique("unique_progress").on(table.userId, table.lessonId),
	unique("user_progress_user_id_lesson_id_key").on(table.userId, table.lessonId),
]);
// Stub of auth.users (a managed schema that is not pulled): only the id that the foreign keys above need.
export const usersInAuth = pgSchema("auth").table("users", {
	id: uuid().primaryKey().notNull(),
});
