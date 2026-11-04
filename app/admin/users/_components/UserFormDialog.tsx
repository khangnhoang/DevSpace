"use client";
import { useEffect, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save, SquarePen, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createNewUser } from "@/app/action/user";
import { editUser, uploadUserAvatar, type UserProfile } from "@/lib/supabase";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  createUserFormSchema,
  editUserFormSchema,
  type CreateUserFormInput,
  type CreateUserFormValues,
} from "@/lib/schemas/user";

// The shadcn controls are restyled here to keep the look this form always had on the always-dark admin surface; the
// generated files stay generic and their tokens would follow the OS colour scheme.
const USER_CONTROL =
  "h-auto rounded-md border-0 bg-[#2C3039] p-2 text-base text-white shadow-none placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-[#3B81F4] aria-invalid:ring-1 aria-invalid:ring-red-500 md:text-base";
const USER_LABEL = "text-base leading-normal font-normal text-white";
const USER_FIELD = "gap-2 [&_[data-slot=native-select-wrapper]]:w-full";
const USER_ERROR = "text-red-400";

const SAVE_FAILED = "Lưu người dùng thất bại. Vui lòng thử lại.";

const createResolver = zodResolver(createUserFormSchema);
// The edit form shares the create form's value shape (its email and password are never rendered or read), so its
// resolver is typed like the create one; the schema it runs only reads the name and the role.
const editResolver = zodResolver(
  editUserFormSchema,
) as unknown as typeof createResolver;

const FIRST_FIELD = 'input:not([disabled]):not([type="file"])';
const TABBABLE =
  'button:not([disabled]), input:not([disabled]):not([type="file"]), select:not([disabled])';

type UserFormDialogProps = {
  user: UserProfile | null;
  onClose: () => void;
  onSaved: () => void;
};

// Mounted only while the dialog is open, and keyed by the user being edited: `defaultValues` come from that user (or
// a blank form with the role `user`) and the chosen file starts empty, so a dialog whose target changes can never
// keep one user's values while saving to another's id.
export default function UserFormDialog(props: UserFormDialogProps) {
  return <UserForm key={props.user?.id ?? "new"} {...props} />;
}

function UserForm({ user, onClose, onSaved }: UserFormDialogProps) {
  const editing = user !== null;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserFormInput, unknown, CreateUserFormValues>({
    resolver: (editing ? editResolver : createResolver) as Resolver<
      CreateUserFormInput,
      unknown,
      CreateUserFormValues
    >,
    defaultValues: {
      email: user?.email ?? "",
      password: "",
      fullName: user?.full_name ?? "",
      // A stored role outside the two (AF-P7) loads as the placeholder, so the admin must pick one to save; the
      // select's value is a plain string at runtime.
      role: (editing
        ? user.role === "user" || user.role === "admin"
          ? user.role
          : ""
        : "user") as CreateUserFormInput["role"],
    },
  });

  // The chosen file is not a text field, so it stays out of the schema.
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    user?.avatar_url || null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Set before the first await: the resolver runs before React Hook Form sets isSubmitting, so a second Enter or
  // click can pass a state-only check and upload or create twice.
  const savingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // The dialog is modal for the keyboard too: focus enters it on open and returns to the control that opened it.
  // The opener is kept in a ref and read once: StrictMode (the dev build) mounts, cleans up and mounts again, and the
  // second mount would otherwise take the field this effect focused as the opener.
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!openerRef.current && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
    cardRef.current?.querySelector<HTMLElement>(FIRST_FIELD)?.focus();
    return () => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, []);

  // Tab wraps inside the card, because the layout around the page (the sidebar) is not inert.
  const keepTabInside = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const items = Array.from(
      cardRef.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? [],
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (!first) {
      e.preventDefault();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const save = async (values: CreateUserFormValues) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    try {
      // Create sends "" when there is no file (the action turns it into null); edit keeps the stored URL.
      let avatarUrl = user?.avatar_url ?? "";
      if (selectedFile) {
        const uploadedUrl = await uploadUserAvatar(selectedFile);
        if (!uploadedUrl) {
          toast.error("Lỗi khi upload avatar user");
          return;
        }
        avatarUrl = uploadedUrl;
      }

      if (user) {
        // The email is never sent: profiles.email must keep matching the Auth email.
        const { error } = await editUser(
          user.id,
          {
            full_name: values.fullName,
            avatar_url: avatarUrl || null,
            role: values.role,
          },
          null,
        );
        if (error) {
          toast.error(SAVE_FAILED);
          return;
        }
      } else {
        // The action's input shape, not the parsed output: it takes a string and turns a blank into null itself.
        const result = await createNewUser({
          email: values.email,
          fullName: values.fullName ?? "",
          role: values.role,
          avatarUrl,
          password: values.password,
        });
        if ("error" in result) {
          toast.error("Lưu người dùng thất bại: " + result.error);
          return;
        }
      }

      toast.success(editing ? "Sửa thành công" : "Thêm thành công");
      onSaved();
      onClose();
    } catch {
      toast.error(SAVE_FAILED);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      {/* The dialog role sits on the card: ARIA in HTML allows no dialog role on a <form>. */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-title"
        onKeyDown={keepTabInside}
        className="w-full max-w-lg md:w-[600px] flex flex-col bg-[#191C24] text-white font-sans rounded-lg shadow-2xl border border-gray-800 animate-in fade-in zoom-in duration-200"
      >
        <form
          onSubmit={(e) => handleSubmit(save)(e)}
          noValidate
          className="contents"
        >
          <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-[#222732] rounded-t-lg">
            <div className="text-lg md:text-xl flex items-center gap-2 font-semibold">
              {editing ? (
                <SquarePen size={20} className="text-[#3B81F4]" />
              ) : (
                <Plus size={20} className="text-[#3B81F4]" />
              )}
              <h1 id="user-form-title">
                {editing ? "Cập Nhật Thông Tin" : "Thêm Thành Viên Mới"}
              </h1>
            </div>
            <button
              type="button"
              aria-label="Đóng"
              onClick={onClose}
              disabled={isSaving}
              className="hover:bg-[#374151] cursor-pointer rounded-md p-1 transition-colors text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={35} />
            </button>
          </div>
          <div className="flex flex-col bg-[#191C24] w-full gap-2 p-3">
            {editing ? (
              // Shown, not editable (Owner decision 2026-11-04): plain text with normal contrast, no input box and not
              // focusable. The email is never sent on save, so profiles.email keeps matching the Auth email.
              <Field className={USER_FIELD}>
                <span className={USER_LABEL}>EMAIL</span>
                <p className="py-2 text-base break-all text-white">
                  {user.email}
                </p>
              </Field>
            ) : (
              <Field className={USER_FIELD} data-invalid={!!errors.email}>
                <FieldLabel htmlFor="user-email" className={USER_LABEL}>
                  EMAIL
                </FieldLabel>
                <Input
                  id="user-email"
                  type="text"
                  className={USER_CONTROL}
                  placeholder="helo@gmail.com"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
                <FieldError className={USER_ERROR} errors={[errors.email]} />
              </Field>
            )}
            {!editing && (
              <Field className={USER_FIELD} data-invalid={!!errors.password}>
                <FieldLabel htmlFor="user-password" className={USER_LABEL}>
                  MẬT KHẨU
                </FieldLabel>
                <Input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  className={USER_CONTROL}
                  placeholder="Tối thiểu 8 ký tự"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                <FieldError className={USER_ERROR} errors={[errors.password]} />
              </Field>
            )}
            <Field className={USER_FIELD} data-invalid={!!errors.fullName}>
              <FieldLabel htmlFor="user-name" className={USER_LABEL}>
                HỌ VÀ TÊN
              </FieldLabel>
              <Input
                id="user-name"
                type="text"
                className={USER_CONTROL}
                placeholder="Nguyen Van A"
                aria-invalid={!!errors.fullName}
                {...register("fullName")}
              />
              <FieldError className={USER_ERROR} errors={[errors.fullName]} />
            </Field>
            {/* PHẦN UPLOAD */}
            <div className="flex ">
              <button
                type="button"
                aria-label="Chọn ảnh đại diện"
                className="relative group w-28 h-28 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center cursor-pointer overflow-hidden hover:border-[#3B81F4] focus-visible:border-[#3B81F4] focus-visible:ring-2 focus-visible:ring-[#3B81F4] outline-none transition-all bg-[#2C3039]"
                onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob: preview URL that next/image does not optimize, tracked in BL-003
                  <img
                    src={previewUrl}
                    alt="Avatar Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="flex flex-col items-center justify-center text-gray-500 group-hover:text-[#3B81F4]">
                    <Upload size={32} />
                    <span className="text-xs mt-1">Upload</span>
                  </span>
                )}

                <span className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                  <SquarePen className="text-white" size={24} />
                </span>
              </button>
              <input
                type="file"
                aria-label="Ảnh đại diện"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
              />
            </div>
            <Field className={USER_FIELD} data-invalid={!!errors.role}>
              <FieldLabel htmlFor="user-role" className={USER_LABEL}>
                VAI TRÒ
              </FieldLabel>
              <NativeSelect
                id="user-role"
                className={cn(USER_CONTROL, "pr-9")}
                aria-invalid={!!errors.role}
                {...register("role")}
              >
                <option value="">Chọn vai trò</option>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </NativeSelect>
              <FieldError className={USER_ERROR} errors={[errors.role]} />
            </Field>
          </div>
          <div className="w-full bg-[#222732] flex justify-end items-center p-4 rounded-b-md gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="hover:bg-[#374151] cursor-pointer p-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="hover:bg-[#2563eb] cursor-pointer p-2 rounded-md text-sm bg-blue-400 flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
            >
              {isSaving ? (
                "Đang xử lý..."
              ) : editing ? (
                <>
                  <Save size={16} /> Lưu Thay Đổi
                </>
              ) : (
                <>
                  <Plus size={16} /> Thêm Tài Khoản
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
