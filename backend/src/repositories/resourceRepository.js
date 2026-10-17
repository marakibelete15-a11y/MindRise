'use strict';

const pool = require('../config/db');

async function getResources({ language = 'en', region = 'ET' } = {}) {
const query = `         SELECT
            id,
            title,
            description,
            resource_type,
            language_code,
            region,
            contact_phone AS "contactPhone",
            url,
            availability,
            is_crisis_resource
        FROM help_resources
        WHERE is_active = TRUE
          AND language_code = $1
          AND region = $2
        ORDER BY title ASC;
    `;

const result = await pool.query(query, [language, region]);

return result.rows;

}

async function getCrisisResources({ language = 'en', region = 'ET' } = {}) {
const query = `         SELECT
            id,
            title,
            description,
            resource_type,
            language_code,
            region,
            contact_phone AS "contactPhone",
            url,
            availability,
            is_crisis_resource
        FROM help_resources
        WHERE is_active = TRUE
          AND is_crisis_resource = TRUE
          AND language_code = $1
          AND region = $2
        ORDER BY title ASC;
    `;

const result = await pool.query(query, [language, region]);

return result.rows;

}

module.exports = {
getResources,
getCrisisResources
};
