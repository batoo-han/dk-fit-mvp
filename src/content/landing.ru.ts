import type { LandingContent } from "./landing-content.types";

export const landingContent = {
  brandName: "D&K Fit",
  hero: {
    title: "Сила становится стилем",
    description: "Персональные тренировки с вниманием к каждой детали.",
    ctaLabel: "Начать персонально",
    imageAlt: "Тренер D&K Fit в спортивной одежде",
  },
  approach: {
    title: "Тренировки, которые подстраиваются под вас, а не наоборот.",
  },
  process: [
    { title: "Знакомство" },
    { title: "План" },
    { title: "Тренировка" },
  ],
  leadForm: {
    title: "Оставьте заявку",
    nameLabel: "Имя",
    phoneLabel: "Телефон",
    goalLabel: "Цель тренировок",
    consentLabel: "Согласие на обработку данных",
    privacyLinkLabel: "Политика обработки данных",
    submitLabel: "Отправить заявку",
    telegramNote:
      "После отправки откроется Telegram. Нажмите Start / Запустить, чтобы получить подтверждение.",
    successMessage: "Заявка отправлена. Открываем Telegram…",
    telegramOpenLabel: "Открыть Telegram",
    errors: {
      required: "Заполните это поле",
      invalidName: "Укажите имя от 2 до 80 символов",
      invalidPhone: "Укажите номер телефона",
      invalidGoal: "Цель тренировок не должна превышать 300 символов",
      consentRequired: "Необходимо согласие на обработку данных",
      unavailable: "Сервис временно недоступен. Попробуйте ещё раз позже.",
      rateLimited: "Слишком много попыток. Попробуйте позже.",
      connection: "Не удалось отправить заявку. Проверьте подключение и повторите попытку.",
    },
  },
} as const satisfies LandingContent;
