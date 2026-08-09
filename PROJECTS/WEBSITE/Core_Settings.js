/**
 * ================================================================
 * MELROSEOS 4.0 — CORE SETTINGS SERVICE
 * Version 4.0.0
 *
 * Central settings repository for MelroseOS 4.0.
 *
 * Existing MelroseOS settings are not removed or overwritten.
 * The new service can fall back to existing getMelroseSetting_()
 * values while the platform is migrated.
 * ================================================================
 */

const M4_SETTINGS = Object.freeze({
  VERSION: '4.0.0',
  SHEET_NAME: 'MelroseOS_Settings',

  TYPES: Object.freeze([
    'STRING',
    'NUMBER',
    'BOOLEAN',
    'DATE',
    'JSON',
    'SECRET_REFERENCE'
  ]),

  CATEGORIES: Object.freeze([
    'SYSTEM',
    'BROKERAGE',
    'BRANDING',
    'EMAIL',
    'MARKETING',
    'ADVERTISING',
    'WEBSITE',
    'DRIVE',
    'COMPLIANCE',
    'AUTOMATION',
    'INTEGRATION',
    'OTHER'
  ])
});


/* =================================================================
   INSTALLER
================================================================= */

function setupMelroseCoreSettings() {
  const startedAt = Date.now();

  try {
    const ss =
      m4_getCommandCenter_();

    const sheet =
      m4_ensureSettingsSheet_(ss);

    m4_seedCoreSettings_(sheet);
    m4_applySettingsValidation_(sheet);
    m4_formatSettingsSheet_(sheet);

    m4_logActivity_({
      module:
        'CORE_SETTINGS',
      action:
        'SETTINGS_SETUP',
      status:
        'SUCCESS',
      details:
        `Core Settings ${M4_SETTINGS.VERSION} installed.`,
      durationMS:
        Date.now() -
        startedAt
    });

    return {
      success: true,
      version:
        M4_SETTINGS.VERSION,
      sheetName:
        M4_SETTINGS.SHEET_NAME,
      settingCount:
        Math.max(
          0,
          sheet.getLastRow() - 1
        )
    };

  } catch (error) {
    m4_logError_(
      'setupMelroseCoreSettings',
      error,
      'CORE_SETTINGS'
    );

    throw error;
  }
}


/* =================================================================
   SHEET
================================================================= */

function m4_ensureSettingsSheet_(
  ss
) {
  return m4_ensureSheet_(
    ss,
    M4_SETTINGS.SHEET_NAME,
    [
      'SettingKey',
      'SettingValue',
      'ValueType',
      'Category',
      'Description',
      'Environment',
      'IsRequired',
      'IsSensitive',
      'UpdatedAt',
      'UpdatedBy',
      'SystemVersion'
    ]
  );
}


/* =================================================================
   DEFAULT SETTINGS
================================================================= */

function m4_seedCoreSettings_(
  sheet
) {
  const defaults = [
    {
      key:
        'SYSTEM_NAME',
      value:
        'MelroseOS',
      type:
        'STRING',
      category:
        'SYSTEM',
      description:
        'Official operating-system name.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'SYSTEM_VERSION',
      value:
        M4_CORE.VERSION,
      type:
        'STRING',
      category:
        'SYSTEM',
      description:
        'Installed MelroseOS core version.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'SYSTEM_TIMEZONE',
      value:
        'America/Chicago',
      type:
        'STRING',
      category:
        'SYSTEM',
      description:
        'Primary operating timezone.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'COMMAND_CENTER_SPREADSHEET_ID',
      value:
        m4_getCommandCenter_().getId(),
      type:
        'STRING',
      category:
        'SYSTEM',
      description:
        'Primary MelroseOS Command Center spreadsheet ID.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'BROKERAGE_NAME',
      value:
        'Melrose Group Realty',
      type:
        'STRING',
      category:
        'BROKERAGE',
      description:
        'Licensed brokerage name.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'BROKER_NAME',
      value:
        'Ulysses A. Barnes, Jr.',
      type:
        'STRING',
      category:
        'BROKERAGE',
      description:
        'Primary broker name.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'BROKER_TITLE',
      value:
        'Broker',
      type:
        'STRING',
      category:
        'BROKERAGE',
      description:
        'Primary broker title.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'BROKER_EMAIL',
      value:
        'melrosegroupbroker@gmail.com',
      type:
        'STRING',
      category:
        'BROKERAGE',
      description:
        'Primary broker and operating email.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'BROKERAGE_PHONE',
      value:
        '(985) 250-0071',
      type:
        'STRING',
      category:
        'BROKERAGE',
      description:
        'Approved public brokerage telephone number.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'BROKERAGE_LOCATION',
      value:
        'Mandeville, LA',
      type:
        'STRING',
      category:
        'BROKERAGE',
      description:
        'Approved brokerage location disclosure.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'LICENSE_DISCLOSURE',
      value:
        'Licensed in Louisiana',
      type:
        'STRING',
      category:
        'COMPLIANCE',
      description:
        'Standard Louisiana license disclosure.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'COMPLIANCE_FOOTER',
      value:
        'Licensed in Louisiana • (985) 250-0071 • Mandeville, LA',
      type:
        'STRING',
      category:
        'COMPLIANCE',
      description:
        'Approved marketing and advertising footer.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'WEBSITE_URL',
      value:
        'https://melrosegrouprealty.com',
      type:
        'STRING',
      category:
        'WEBSITE',
      description:
        'Primary brokerage website.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'BOOK_NOW_URL',
      value:
        'https://melrosegrouprealty.com/book-now',
      type:
        'STRING',
      category:
        'MARKETING',
      description:
        'Primary consultation and lead destination.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'BUSINESS_CARD_FILE_ID',
      value:
        '1jqKjYqgOB9B_r5owweR-b9q9SyFDlfR5',
      type:
        'STRING',
      category:
        'BRANDING',
      description:
        'Approved primary business-card Drive file ID.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'ULYSSES_HEADSHOT_FILE_ID',
      value:
        '1XREInUsxWy_2Tlw81mVGllgwJf7ytdaM',
      type:
        'STRING',
      category:
        'BRANDING',
      description:
        'Approved Ulysses headshot Drive file ID.',
      required:
        false,
      sensitive:
        false
    },
    {
      key:
        'SAMANTHA_HEADSHOT_FILE_ID',
      value:
        '1FP5Evu2BNdwPH2JRDtJPdKJ0CSxmXH7g',
      type:
        'STRING',
      category:
        'BRANDING',
      description:
        'Approved Samantha headshot Drive file ID.',
      required:
        false,
      sensitive:
        false
    },
    {
      key:
        'MARKETING_SUITE_VERSION',
      value:
        '4.0.0',
      type:
        'STRING',
      category:
        'MARKETING',
      description:
        'Installed Marketing Suite version.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'MARKETING_USE_HUMAN_FACES',
      value:
        'FALSE',
      type:
        'BOOLEAN',
      category:
        'MARKETING',
      description:
        'Controls whether personal photographs may be selected for new advertising.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'MARKETING_REQUIRE_ASSET_APPROVAL',
      value:
        'TRUE',
      type:
        'BOOLEAN',
      category:
        'MARKETING',
      description:
        'Requires broker approval before an asset is used.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'MARKETING_REQUIRE_COMPLIANCE_REVIEW',
      value:
        'TRUE',
      type:
        'BOOLEAN',
      category:
        'COMPLIANCE',
      description:
        'Requires compliance review before marketing release.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'DEFAULT_BUYER_AD_DAILY_BUDGET',
      value:
        '10',
      type:
        'NUMBER',
      category:
        'ADVERTISING',
      description:
        'Default daily buyer advertising budget.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'DEFAULT_SELLER_AD_DAILY_BUDGET',
      value:
        '10',
      type:
        'NUMBER',
      category:
        'ADVERTISING',
      description:
        'Default daily seller advertising budget.',
      required:
        true,
      sensitive:
        false
    },
    {
      key:
        'DEFAULT_PAGE_GROWTH_DAILY_BUDGET',
      value:
        '3',
      type:
        'NUMBER',
      category:
        'ADVERTISING',
      description:
        'Default daily social-page growth budget.',
      required:
        false,
      sensitive:
        false
    }
  ];

  defaults.forEach(setting => {
    const existingRow =
      m4_findRow_(
        sheet,
        'SettingKey',
        setting.key
      );

    if (existingRow) {
      return;
    }

    m4_appendObject_(
      sheet,
      {
        SettingKey:
          setting.key,
        SettingValue:
          setting.value,
        ValueType:
          setting.type,
        Category:
          setting.category,
        Description:
          setting.description,
        Environment:
          M4_CORE.ENVIRONMENT,
        IsRequired:
          setting.required,
        IsSensitive:
          setting.sensitive,
        UpdatedAt:
          new Date(),
        UpdatedBy:
          m4_currentUser_(),
        SystemVersion:
          M4_SETTINGS.VERSION
      }
    );
  });

  return {
    success: true,
    defaults:
      defaults.length
  };
}


/* =================================================================
   PUBLIC SETTINGS API
================================================================= */

/**
 * Returns a setting converted to its configured type.
 *
 * Falls back to the existing MelroseOS settings service during
 * migration when a value is not present in MelroseOS_Settings.
 */
function m4_getSetting_(
  key,
  fallback
) {
  const settingKey =
    m4_trim_(key)
      .toUpperCase();

  if (!settingKey) {
    return fallback;
  }

  try {
    const ss =
      m4_getCommandCenter_();

    const sheet =
      ss.getSheetByName(
        M4_SETTINGS.SHEET_NAME
      );

    if (
      sheet &&
      sheet.getLastRow() >= 2
    ) {
      const row =
        m4_findRow_(
          sheet,
          'SettingKey',
          settingKey
        );

      if (row) {
        const record =
          m4_readRowObject_(
            sheet,
            row
          );

        return m4_convertSettingValue_(
          record.SettingValue,
          record.ValueType,
          fallback
        );
      }
    }
  } catch (ignored) {
    // Continue to old service.
  }

  if (
    typeof getMelroseSetting_ ===
    'function'
  ) {
    try {
      const legacyValue =
        getMelroseSetting_(
          settingKey,
          fallback
        );

      return legacyValue;
    } catch (ignored) {
      // Use fallback.
    }
  }

  return fallback;
}


/**
 * Creates or updates a setting.
 */
function m4_setSetting_(
  key,
  value,
  options
) {
  const settingKey =
    m4_trim_(key)
      .toUpperCase();

  if (!settingKey) {
    throw new Error(
      'A setting key is required.'
    );
  }

  const settings =
    options &&
    typeof options === 'object'
      ? options
      : {};

  const ss =
    m4_getCommandCenter_();

  const sheet =
    m4_ensureSettingsSheet_(ss);

  const row =
    m4_findRow_(
      sheet,
      'SettingKey',
      settingKey
    );

  const record = {
    SettingKey:
      settingKey,
    SettingValue:
      m4_serializeSettingValue_(
        value,
        settings.type
      ),
    ValueType:
      settings.type ||
      m4_detectSettingType_(value),
    Category:
      settings.category ||
      'OTHER',
    Description:
      settings.description || '',
    Environment:
      settings.environment ||
      M4_CORE.ENVIRONMENT,
    IsRequired:
      settings.required === true,
    IsSensitive:
      settings.sensitive === true,
    UpdatedAt:
      new Date(),
    UpdatedBy:
      m4_currentUser_(),
    SystemVersion:
      M4_SETTINGS.VERSION
  };

  if (row) {
    m4_updateObject_(
      sheet,
      row,
      record
    );
  } else {
    m4_appendObject_(
      sheet,
      record
    );
  }

  return {
    success: true,
    created: !row,
    key:
      settingKey,
    value
  };
}


/**
 * Returns true when a setting exists.
 */
function m4_hasSetting_(
  key
) {
  const ss =
    m4_getCommandCenter_();

  const sheet =
    ss.getSheetByName(
      M4_SETTINGS.SHEET_NAME
    );

  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return false;
  }

  return Boolean(
    m4_findRow_(
      sheet,
      'SettingKey',
      m4_trim_(key)
        .toUpperCase()
    )
  );
}


/**
 * Returns every setting as a key/value object.
 */
function m4_getAllSettings_() {
  const ss =
    m4_getCommandCenter_();

  const sheet =
    m4_ensureSettingsSheet_(ss);

  const records =
    m4_readObjects_(sheet);

  const output = {};

  records.forEach(record => {
    if (!record.SettingKey) {
      return;
    }

    output[
      String(
        record.SettingKey
      ).toUpperCase()
    ] =
      m4_convertSettingValue_(
        record.SettingValue,
        record.ValueType,
        ''
      );
  });

  return output;
}


/* =================================================================
   TYPE CONVERSION
================================================================= */

function m4_convertSettingValue_(
  value,
  type,
  fallback
) {
  const valueType =
    m4_trim_(type)
      .toUpperCase() ||
    'STRING';

  switch (valueType) {
    case 'NUMBER':
      return m4_number_(
        value,
        fallback
      );

    case 'BOOLEAN':
      return m4_boolean_(value);

    case 'DATE':
      return m4_date_(value) ||
        fallback;

    case 'JSON':
      try {
        return typeof value ===
          'string'
            ? JSON.parse(value)
            : value;
      } catch (ignored) {
        return fallback;
      }

    default:
      return value !== undefined &&
        value !== null &&
        value !== ''
          ? value
          : fallback;
  }
}


function m4_serializeSettingValue_(
  value,
  suppliedType
) {
  const type =
    suppliedType ||
    m4_detectSettingType_(value);

  if (
    String(type).toUpperCase() ===
    'JSON'
  ) {
    return JSON.stringify(value);
  }

  if (
    value instanceof Date
  ) {
    return value;
  }

  return String(
    value ?? ''
  );
}


function m4_detectSettingType_(
  value
) {
  if (
    typeof value === 'boolean'
  ) {
    return 'BOOLEAN';
  }

  if (
    typeof value === 'number'
  ) {
    return 'NUMBER';
  }

  if (
    value instanceof Date
  ) {
    return 'DATE';
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    return 'JSON';
  }

  return 'STRING';
}


/* =================================================================
   VALIDATION AND FORMATTING
================================================================= */

function m4_applySettingsValidation_(
  sheet
) {
  m4_ensureRows_(
    sheet,
    1501
  );

  const rows =
    sheet.getMaxRows() - 1;

  sheet
    .getRange(
      2,
      3,
      rows,
      1
    )
    .setDataValidation(
      m4_listValidation_(
        M4_SETTINGS.TYPES
      )
    );

  sheet
    .getRange(
      2,
      4,
      rows,
      1
    )
    .setDataValidation(
      m4_listValidation_(
        M4_SETTINGS.CATEGORIES
      )
    );

  m4_checkboxRange_(
    sheet.getRange(
      2,
      7,
      rows,
      1
    )
  );

  m4_checkboxRange_(
    sheet.getRange(
      2,
      8,
      rows,
      1
    )
  );

  return {
    success: true,
    rows
  };
}


function m4_formatSettingsSheet_(
  sheet
) {
  sheet.setColumnWidth(1, 285);
  sheet.setColumnWidth(2, 420);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 130);
  sheet.setColumnWidth(5, 430);
  sheet.setColumnWidth(6, 120);
  sheet.setColumnWidth(7, 100);
  sheet.setColumnWidth(8, 100);
  sheet.setColumnWidth(9, 165);
  sheet.setColumnWidth(10, 230);
  sheet.setColumnWidth(11, 125);

  sheet
    .getDataRange()
    .setVerticalAlignment('top');

  return sheet;
}


/* =================================================================
   SETTINGS TEST
================================================================= */

function testMelroseCoreSettings() {
  const testKey =
    'CORE_SETTINGS_TEST_VALUE';

  const testValue =
    m4_createID_('SETTINGTEST');

  m4_setSetting_(
    testKey,
    testValue,
    {
      type: 'STRING',
      category: 'SYSTEM',
      description:
        'Temporary Core Settings validation record.'
    }
  );

  const returned =
    m4_getSetting_(
      testKey,
      ''
    );

  return {
    success:
      returned === testValue,
    key:
      testKey,
    expected:
      testValue,
    actual:
      returned
  };
}