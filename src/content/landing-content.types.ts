export type LandingNavigationItem = {
  href: string;
  label: string;
};

export type LandingContent = {
  brandName: string;
  navigation: readonly LandingNavigationItem[];
  hero: {
    title: string;
    description: string;
    ctaLabel: string;
    imageAlt: string;
  };
  approach: {
    title: string;
  };
  process: readonly {
    title: string;
  }[];
  leadForm: {
    title: string;
    nameLabel: string;
    phoneLabel: string;
    goalLabel: string;
    consentLabel: string;
    privacyLinkLabel: string;
    submitLabel: string;
    telegramNote: string;
    successMessage: string;
    errors: {
      required: string;
      invalidName: string;
      invalidPhone: string;
      invalidGoal: string;
      consentRequired: string;
      unavailable: string;
      rateLimited: string;
      connection: string;
    };
  };
};
