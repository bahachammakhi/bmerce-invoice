import n2words from 'n2words';

export function numberToWords(amount: number, currency: string = 'TND', lang: 'fr' | 'en' = 'fr'): string {
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 1000); // 3 decimals for TND

  const integerWords = n2words(integerPart, { lang });
  
  let decimalWords = '';
  if (decimalPart > 0) {
    if (currency === 'TND') {
      decimalWords = ` et ${decimalPart} millimes`;
    } else {
      // For 2 decimals currencies
      const decimal2 = Math.round((amount - integerPart) * 100);
      decimalWords = ` et ${decimal2} ${lang === 'fr' ? 'centimes' : 'cents'}`;
    }
  }

  const currencyName = getCurrencyName(currency, lang, integerPart > 1);

  return `${integerWords} ${currencyName}${decimalWords}`;
}

function getCurrencyName(code: string, lang: 'fr' | 'en', plural: boolean): string {
  const currencies: Record<string, { fr: [string, string], en: [string, string] }> = {
    'TND': { fr: ['Dinar', 'Dinars'], en: ['Dinar', 'Dinars'] },
    'EUR': { fr: ['Euro', 'Euros'], en: ['Euro', 'Euros'] },
    'USD': { fr: ['Dollar', 'Dollars'], en: ['Dollar', 'Dollars'] },
    'GBP': { fr: ['Livre', 'Livres'], en: ['Pound', 'Pounds'] },
  };

  const entry = currencies[code] || { fr: [code, code], en: [code, code] };
  return entry[lang][plural ? 1 : 0];
}
