import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

import styles from "./Field.module.css";

type FieldBaseProps = {
  id: string;
  label: string;
  error?: string;
};

type InputFieldProps = FieldBaseProps & InputHTMLAttributes<HTMLInputElement>;
type TextareaFieldProps = FieldBaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField({ id, label, error, ...props }, ref) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} id={id} ref={ref} {...props} />
      {error ? <p className={styles.error} id={errorId}>{error}</p> : null}
    </div>
  );
});

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField({ id, label, error, ...props }, ref) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <textarea aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} id={id} ref={ref} {...props} />
      {error ? <p className={styles.error} id={errorId}>{error}</p> : null}
    </div>
  );
});
