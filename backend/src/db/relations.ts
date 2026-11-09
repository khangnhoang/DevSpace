import { relations } from "drizzle-orm/relations";
import { chapters, comments, coupons, courses, enrollments, exercises, instructors, lessons, notes, notifications, payments, profiles, reviews, userProgress, usersInAuth } from "./schema";

export const chaptersRelations = relations(chapters, ({one, many}) => ({
	course: one(courses, {
		fields: [chapters.courseId],
		references: [courses.id]
	}),
	lessons: many(lessons),
}));

export const commentsRelations = relations(comments, ({one}) => ({
	lesson: one(lessons, {
		fields: [comments.lessonId],
		references: [lessons.id]
	}),
	profile: one(profiles, {
		fields: [comments.userId],
		references: [profiles.id]
	}),
}));

export const couponsRelations = relations(coupons, ({many}) => ({
	payments: many(payments),
}));

export const coursesRelations = relations(courses, ({one, many}) => ({
	chapters: many(chapters),
	enrollments: many(enrollments),
	instructor: one(instructors, {
		fields: [courses.instructorId],
		references: [instructors.id]
	}),
	lessons: many(lessons),
	payments: many(payments),
	reviews: many(reviews),
}));

export const enrollmentsRelations = relations(enrollments, ({one}) => ({
	course: one(courses, {
		fields: [enrollments.courseId],
		references: [courses.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [enrollments.userId],
		references: [usersInAuth.id]
	}),
}));

export const exercisesRelations = relations(exercises, ({one}) => ({
	lesson: one(lessons, {
		fields: [exercises.lessonId],
		references: [lessons.id]
	}),
}));

export const instructorsRelations = relations(instructors, ({one, many}) => ({
	courses: many(courses),
	profile: one(profiles, {
		fields: [instructors.userId],
		references: [profiles.id]
	}),
}));

export const lessonsRelations = relations(lessons, ({one, many}) => ({
	chapter: one(chapters, {
		fields: [lessons.chapterId],
		references: [chapters.id]
	}),
	comments: many(comments),
	course: one(courses, {
		fields: [lessons.courseId],
		references: [courses.id]
	}),
	exercises: many(exercises),
	notes: many(notes),
	userProgresses: many(userProgress),
}));

export const notesRelations = relations(notes, ({one}) => ({
	lesson: one(lessons, {
		fields: [notes.lessonId],
		references: [lessons.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [notes.userId],
		references: [usersInAuth.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	usersInAuth_actorId: one(usersInAuth, {
		fields: [notifications.actorId],
		references: [usersInAuth.id],
		relationName: "notifications_actorId_usersInAuth_id"
	}),
	usersInAuth_receiverId: one(usersInAuth, {
		fields: [notifications.receiverId],
		references: [usersInAuth.id],
		relationName: "notifications_receiverId_usersInAuth_id"
	}),
}));

export const paymentsRelations = relations(payments, ({one}) => ({
	coupon: one(coupons, {
		fields: [payments.couponId],
		references: [coupons.id]
	}),
	course: one(courses, {
		fields: [payments.courseId],
		references: [courses.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [payments.userId],
		references: [usersInAuth.id]
	}),
}));

export const profilesRelations = relations(profiles, ({one, many}) => ({
	comments: many(comments),
	instructors: many(instructors),
	reviews: many(reviews),
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
}));

export const reviewsRelations = relations(reviews, ({one}) => ({
	course: one(courses, {
		fields: [reviews.courseId],
		references: [courses.id]
	}),
	profile: one(profiles, {
		fields: [reviews.userId],
		references: [profiles.id]
	}),
}));

export const userProgressRelations = relations(userProgress, ({one}) => ({
	lesson: one(lessons, {
		fields: [userProgress.lessonId],
		references: [lessons.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [userProgress.userId],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	enrollments: many(enrollments),
	notes: many(notes),
	notifications_actorId: many(notifications, {
		relationName: "notifications_actorId_usersInAuth_id"
	}),
	notifications_receiverId: many(notifications, {
		relationName: "notifications_receiverId_usersInAuth_id"
	}),
	payments: many(payments),
	profiles: many(profiles),
	userProgresses: many(userProgress),
}));
