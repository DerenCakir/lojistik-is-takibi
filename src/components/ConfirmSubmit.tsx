"use client";

type Props = {
  message: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
};

// Bir <form> içinde kullanılır; tıklayınca onay ister, iptal edilirse gönderimi durdurur.
export default function ConfirmSubmit({ message, className, title, children }: Props) {
  return (
    <button
      type="submit"
      className={className}
      title={title}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
