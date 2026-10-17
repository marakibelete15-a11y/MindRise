'use strict';

// Detect possible safety signals, not mental-health diagnoses.
// Detection rules must be reviewed before production use.

const SUPPORTED_LANGUAGES = ['en', 'am'];

function scan(text, languageCode = 'en') {
if (typeof text !== 'string' || !text.trim()) {
return {
flagged: false,
reason: 'no_text',
languageCode
};
}

if (!SUPPORTED_LANGUAGES.includes(languageCode)) {
    return {
        flagged: false,
        reason: 'unsupported_language',
        languageCode
    };
}

// No unreviewed keywords or invented clinical thresholds.
// Until the team approves detection rules, return an explicit
// unconfigured result rather than pretending a scan is reliable.
return {
    flagged: false,
    reason: 'detection_rules_not_configured',
    languageCode
};

}

module.exports = { scan };
