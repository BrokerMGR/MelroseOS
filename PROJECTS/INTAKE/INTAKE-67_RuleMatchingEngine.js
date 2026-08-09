const INTAKE_RULE_MATCHER = Object.freeze({

  VERSION: '1.0.0',

  AUTO_APPLY_THRESHOLD: 95,

  REVIEW_THRESHOLD: 70

});

function INTAKE_scoreRuleMatch(message, rule) {

  let score = 0;

  const from =
    String(
      message.from || ''
    ).toLowerCase();

  const subject =
    String(
      message.subject || ''
    ).toLowerCase();

  const body =
    String(
      message.body || ''
    ).toLowerCase();

  if (
    rule.senderPattern &&
    from.indexOf(
      String(
        rule.senderPattern
      ).toLowerCase()
    ) !== -1
  ) {
    score += 40;
  }

  if (
    rule.subjectPattern &&
    subject.indexOf(
      String(
        rule.subjectPattern
      ).toLowerCase()
    ) !== -1
  ) {
    score += 30;
  }

  if (
    rule.bodySignature &&
    body.indexOf(
      String(
        rule.bodySignature
      ).toLowerCase()
    ) !== -1
  ) {
    score += 30;
  }

  return Math.min(
    100,
    score
  );

}

function INTAKE_findBestRuleMatch(
  message,
  rules
) {

  const candidates =
    Array.isArray(rules)
      ? rules
      : [];

  let best = null;

  candidates.forEach(
    function(rule) {

      if (
        rule.active === false
      ) {
        return;
      }

      const score =
        INTAKE_scoreRuleMatch(
          message,
          rule
        );

      if (
        !best ||
        score > best.score
      ) {

        best = {

          rule:
            rule,

          score:
            score

        };

      }

    }
  );

  return best;

}

function INTAKE_buildRuleMatchDecision(
  message,
  rules
) {

  const match =
    INTAKE_findBestRuleMatch(
      message,
      rules
    );

  if (!match) {

    return {

      matched:
        false,

      score:
        0,

      action:
        'BROKER_REVIEW',

      rule:
        null

    };

  }

  return {

    matched:
      true,

    score:
      match.score,

    action:

      match.score >=
        INTAKE_RULE_MATCHER
          .AUTO_APPLY_THRESHOLD

        ? 'AUTO_APPLY'

        : match.score >=
            INTAKE_RULE_MATCHER
              .REVIEW_THRESHOLD

          ? 'BROKER_CONFIRM'

          : 'BROKER_REVIEW',

    rule:
      match.rule

  };

}