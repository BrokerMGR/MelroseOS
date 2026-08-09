const INTAKE_NAME_ENGINE = Object.freeze({

  VERSION: '1.0.0',

  TITLE_WORDS: [
    'mr',
    'mrs',
    'ms',
    'miss',
    'dr'
  ]

});

function INTAKE_extractName(message) {

  const from = String(
    message.from || ''
  ).trim();

  let displayName = from;

  const angleIndex =
    displayName.indexOf('<');

  if (angleIndex > 0) {

    displayName =
      displayName
        .substring(0, angleIndex)
        .trim();

  }

  displayName =
    displayName
      .replace(/^["']|["']$/g, '')
      .trim();

  const parts =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .filter(function(part) {

        return !INTAKE_NAME_ENGINE.TITLE_WORDS.includes(
          part.toLowerCase().replace(/\./g, '')
        );

      });

  return {

    fullName:
      parts.join(' '),

    firstName:
      parts.length > 0
        ? parts[0]
        : '',

    lastName:
      parts.length > 1
        ? parts[parts.length - 1]
        : '',

    extractedAt:
      new Date().toISOString()

  };

}