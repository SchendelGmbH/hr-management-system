import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // Default to German
  const locale = 'de';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
