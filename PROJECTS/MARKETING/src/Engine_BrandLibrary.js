/**
 * ================================================================
 * MELROSEOS 4.0 — BRAND LIBRARY
 * Version 4.0.0
 *
 * Central brand asset and standards library.
 *
 * Public functions:
 * - setupMelroseBrandLibrary()
 * - seedMelroseBrandLibrary()
 * - refreshMelroseBrandLibrary()
 * - openMelroseBrandLibrary()
 * - getMelroseBrandAsset()
 * - testMelroseBrandLibrary()
 * ================================================================
 */

var M4_BRAND_LIBRARY = Object.freeze({
  VERSION: '4.0.0',
  MODULE: 'BRAND_LIBRARY',

  SHEETS: Object.freeze({
    LIBRARY: 'AdvertisingBrandLibrary',
    COLORS: 'AdvertisingBrandColors',
    RULES: 'AdvertisingBrandRules'
  }),

  ASSET_TYPES: Object.freeze([
    'LOGO',
    'BUSINESS_CARD',
    'HEADSHOT',
    'QR_CODE',
    'ICON',
    'FONT',
    'FOOTER',
    'OTHER'
  ]),

  STATUSES: Object.freeze([
    'ACTIVE',
    'INACTIVE',
    'REVIEW',
    'ARCHIVED'
  ])
});


/* =================================================================
   SETUP
================================================================= */

function setupMelroseBrandLibrary() {
  const startedAt = Date.now();

  try {
    const ss = m4_getCommandCenter_();

    m4_ensureBrandLibrarySheet_(ss);
    m4_ensureBrandColorsSheet_(ss);
    m4_ensureBrandRulesSheet_(ss);

    seedMelroseBrandLibrary();
    m4_formatBrandLibrary_();

    m4_setSetting_(
      'BRAND_LIBRARY_VERSION',
      M4_BRAND_LIBRARY.VERSION,
      {
        type: 'STRING',
        category: 'BRANDING',
        description:
          'Installed MelroseOS Brand Library version.',
        required: true
      }
    );

    if (
      typeof registerMelroseEngine ===
      'function'
    ) {
      registerMelroseEngine({
        componentKey:
          'ENGINE.BRAND_LIBRARY',
        engineName:
          'Brand Library',
        module:
          'MARKETING',
        version:
          M4_BRAND_LIBRARY.VERSION,
        setupFunction:
          'setupMelroseBrandLibrary',
        requiredSheet:
          M4_BRAND_LIBRARY.SHEETS.LIBRARY,
        required:
          true,
        description:
          'Central Melrose Group Realty brand asset and standards library.'
      });
    }

    if (
      typeof registerMelroseSheet ===
      'function'
    ) {
      registerMelroseSheet({
        componentKey:
          'SHEET.BRAND_LIBRARY',
        sheetName:
          M4_BRAND_LIBRARY.SHEETS.LIBRARY,
        componentName:
          'Advertising Brand Library',
        module:
          'MARKETING',
        version:
          M4_BRAND_LIBRARY.VERSION,
        required:
          true,
        description:
          'Master brand asset catalog.'
      });

      registerMelroseSheet({
        componentKey:
          'SHEET.BRAND_COLORS',
        sheetName:
          M4_BRAND_LIBRARY.SHEETS.COLORS,
        componentName:
          'Advertising Brand Colors',
        module:
          'MARKETING',
        version:
          M4_BRAND_LIBRARY.VERSION,
        required:
          true,
        description:
          'Approved brand color palette.'
      });

      registerMelroseSheet({
        componentKey:
          'SHEET.BRAND_RULES',
        sheetName:
          M4_BRAND_LIBRARY.SHEETS.RULES,
        componentName:
          'Advertising Brand Rules',
        module:
          'MARKETING',
        version:
          M4_BRAND_LIBRARY.VERSION,
        required:
          true,
        description:
          'Approved brand and compliance rules.'
      });
    }

    if (
      typeof registerMelroseDependency ===
      'function'
    ) {
      registerMelroseDependency({
        source:
          'ENGINE.BRAND_LIBRARY',
        type:
          'REQUIRES',
        target:
          'ENGINE.CORE_COMMON',
        required:
          true,
        notes:
          'Brand Library uses shared core services.'
      });

      registerMelroseDependency({
        source:
          'ENGINE.BRAND_LIBRARY',
        type:
          'REQUIRES',
        target:
          'ENGINE.CORE_SETTINGS',
        required:
          true,
        notes:
          'Brand Library reads centralized branding settings.'
      });
    }

    m4_logActivity_({
      module:
        M4_BRAND_LIBRARY.MODULE,
      action:
        'BRAND_LIBRARY_SETUP',
      status:
        'SUCCESS',
      details:
        `Brand Library ${M4_BRAND_LIBRARY.VERSION} installed.`,
      durationMS:
        Date.now() - startedAt
    });

    return {
      success: true,
      version:
        M4_BRAND_LIBRARY.VERSION
    };

  } catch (error) {
    m4_logError_(
      'setupMelroseBrandLibrary',
      error,
      M4_BRAND_LIBRARY.MODULE
    );

    throw error;
  }
}


/* =================================================================
   SHEETS
================================================================= */

function m4_ensureBrandLibrarySheet_(ss) {
  return m4_ensureSheet_(
    ss,
    M4_BRAND_LIBRARY.SHEETS.LIBRARY,
    [
      'BrandAssetID',
      'AssetName',
      'AssetType',
      'DriveFileID',
      'SettingKey',
      'PrimaryUse',
      'Required',
      'Status',
      'UsageRightsConfirmed',
      'ComplianceApproved',
      'BrokerApproved',
      'PreviewURL',
      'Notes',
      'CreatedAt',
      'UpdatedAt',
      'BrandLibraryVersion'
    ],
    {
      frozenRows: 1
    }
  );
}


function m4_ensureBrandColorsSheet_(ss) {
  return m4_ensureSheet_(
    ss,
    M4_BRAND_LIBRARY.SHEETS.COLORS,
    [
      'ColorID',
      'ColorName',
      'HexValue',
      'PrimaryUse',
      'Status',
      'Notes',
      'CreatedAt',
      'UpdatedAt',
      'BrandLibraryVersion'
    ],
    {
      frozenRows: 1
    }
  );
}


function m4_ensureBrandRulesSheet_(ss) {
  return m4_ensureSheet_(
    ss,
    M4_BRAND_LIBRARY.SHEETS.RULES,
    [
      'RuleID',
      'RuleName',
      'RuleCategory',
      'RuleValue',
      'Required',
      'Status',
      'Description',
      'CreatedAt',
      'UpdatedAt',
      'BrandLibraryVersion'
    ],
    {
      frozenRows: 1
    }
  );
}


/* =================================================================
   SEEDING
================================================================= */

function seedMelroseBrandLibrary() {
  const ss = m4_getCommandCenter_();

  const librarySheet =
    m4_ensureBrandLibrarySheet_(ss);

  const colorSheet =
    m4_ensureBrandColorsSheet_(ss);

  const rulesSheet =
    m4_ensureBrandRulesSheet_(ss);

  const now = new Date();

  const assets = [
    {
      BrandAssetID:
        'BRAND-BUSINESS-CARD-MAIN',
      AssetName:
        'Main Business Card',
      AssetType:
        'BUSINESS_CARD',
      DriveFileID:
        m4_getSetting_(
          'BUSINESS_CARD_FILE_ID',
          '1jqKjYqgOB9B_r5owweR-b9q9SyFDlfR5'
        ),
      SettingKey:
        'BUSINESS_CARD_FILE_ID',
      PrimaryUse:
        'EMAIL_SIGNATURE,COMPLIANCE',
      Required:
        true,
      Status:
        'ACTIVE',
      UsageRightsConfirmed:
        true,
      ComplianceApproved:
        true,
      BrokerApproved:
        true,
      PreviewURL:
        '',
      Notes:
        'Approved primary business card image.',
      CreatedAt:
        now,
      UpdatedAt:
        now,
      BrandLibraryVersion:
        M4_BRAND_LIBRARY.VERSION
    },
    {
      BrandAssetID:
        'BRAND-HEADSHOT-ULYSSES',
      AssetName:
        'Ulysses Headshot',
      AssetType:
        'HEADSHOT',
      DriveFileID:
        m4_getSetting_(
          'ULYSSES_HEADSHOT_FILE_ID',
          '1XREInUsxWy_2Tlw81mVGllgwJf7ytdaM'
        ),
      SettingKey:
        'ULYSSES_HEADSHOT_FILE_ID',
      PrimaryUse:
        'BRAND_AWARENESS,RETARGETING',
      Required:
        false,
      Status:
        'ACTIVE',
      UsageRightsConfirmed:
        true,
      ComplianceApproved:
        false,
      BrokerApproved:
        true,
      PreviewURL:
        '',
      Notes:
        'Not enabled for cold-traffic ads by default.',
      CreatedAt:
        now,
      UpdatedAt:
        now,
      BrandLibraryVersion:
        M4_BRAND_LIBRARY.VERSION
    },
    {
      BrandAssetID:
        'BRAND-HEADSHOT-SAMANTHA',
      AssetName:
        'Samantha Headshot',
      AssetType:
        'HEADSHOT',
      DriveFileID:
        m4_getSetting_(
          'SAMANTHA_HEADSHOT_FILE_ID',
          '1FP5Evu2BNdwPH2JRDtJPdKJ0CSxmXH7g'
        ),
      SettingKey:
        'SAMANTHA_HEADSHOT_FILE_ID',
      PrimaryUse:
        'BRAND_AWARENESS,RETARGETING',
      Required:
        false,
      Status:
        'ACTIVE',
      UsageRightsConfirmed:
        true,
      ComplianceApproved:
        false,
      BrokerApproved:
        true,
      PreviewURL:
        '',
      Notes:
        'Not enabled for cold-traffic ads by default.',
      CreatedAt:
        now,
      UpdatedAt:
        now,
      BrandLibraryVersion:
        M4_BRAND_LIBRARY.VERSION
    },
    {
      BrandAssetID:
        'BRAND-COMPLIANCE-FOOTER',
      AssetName:
        'Louisiana Compliance Footer',
      AssetType:
        'FOOTER',
      DriveFileID:
        '',
      SettingKey:
        'COMPLIANCE_FOOTER',
      PrimaryUse:
        'ALL_MARKETING',
      Required:
        true,
      Status:
        'ACTIVE',
      UsageRightsConfirmed:
        true,
      ComplianceApproved:
        true,
      BrokerApproved:
        true,
      PreviewURL:
        '',
      Notes:
        m4_getSetting_(
          'COMPLIANCE_FOOTER',
          'Licensed in Louisiana • (985) 250-0071 • Mandeville, LA'
        ),
      CreatedAt:
        now,
      UpdatedAt:
        now,
      BrandLibraryVersion:
        M4_BRAND_LIBRARY.VERSION
    }
  ];

  assets.forEach(asset =>
    m4_upsertObject_(
      librarySheet,
      'BrandAssetID',
      asset
    )
  );

  const colors = [
    {
      ColorID: 'COLOR-NAVY',
      ColorName: 'Melrose Navy',
      HexValue: '#0B1F3A',
      PrimaryUse: 'PRIMARY_BACKGROUND',
      Status: 'ACTIVE',
      Notes: '',
      CreatedAt: now,
      UpdatedAt: now,
      BrandLibraryVersion:
        M4_BRAND_LIBRARY.VERSION
    },
    {
      ColorID: 'COLOR-GOLD',
      ColorName: 'Melrose Gold',
      HexValue: '#C9A227',
      PrimaryUse: 'ACCENT',
      Status: 'ACTIVE',
      Notes: '',
      CreatedAt: now,
      UpdatedAt: now,
      BrandLibraryVersion:
        M4_BRAND_LIBRARY.VERSION
    },
    {
      ColorID: 'COLOR-WHITE',
      ColorName: 'White',
      HexValue: '#FFFFFF',
      PrimaryUse: 'TEXT,BACKGROUND',
      Status: 'ACTIVE',
      Notes: '',
      CreatedAt: now,
      UpdatedAt: now,
      BrandLibraryVersion:
        M4_BRAND_LIBRARY.VERSION
    }
  ];

  colors.forEach(color =>
    m4_upsertObject_(
      colorSheet,
      'ColorID',
      color
    )
  );

  const rules = [
    {
      RuleID:
        'RULE-LOGO-UNCHANGED',
      RuleName:
        'Do Not Alter Official Logo',
      RuleCategory:
        'LOGO',
      RuleValue:
        'TRUE',
      Required:
        true,
      Status:
        'ACTIVE',
      Description:
        'Official logos may not be recolored, distorted, recreated, simplified or modified.',
      CreatedAt:
        now,
      UpdatedAt:
        now,
      BrandLibraryVersion:
        M4_BRAND_LIBRARY.VERSION
    },
    {
      RuleID:
        'RULE-PHONE-ONCE',
      RuleName:
        'Phone Number Appears Once',
      RuleCategory:
        'COMPLIANCE',
      RuleValue:
        '1',
      Required:
        true,
      Status:
        'ACTIVE',
      Description:
        'The approved brokerage phone number may appear only once in the graphic.',
      CreatedAt:
        now,
      UpdatedAt:
        now,
      BrandLibraryVersion:
        M4_BRAND_LIBRARY.VERSION
    },
    {
      RuleID:
        'RULE-LOCATION-ONCE',
      RuleName:
        'Mandeville Appears Once',
      RuleCategory:
        'COMPLIANCE',
      RuleValue:
        '1',
      Required:
        true,
      Status:
        'ACTIVE',
      Description:
        'Mandeville, LA may appear only once and only in the approved footer.',
      CreatedAt:
        now,
      UpdatedAt:
        now,
      BrandLibraryVersion:
        M4_BRAND_LIBRARY.VERSION
    },
    {
      RuleID:
        'RULE-HUMAN-FACES',
      RuleName:
        'Human Faces Disabled for Cold Ads',
      RuleCategory:
        'ADVERTISING',
      RuleValue:
        String(
          m4_getSetting_(
            'MARKETING_USE_HUMAN_FACES',
            false
          )
        ).toUpperCase(),
      Required:
        true,
      Status:
        'ACTIVE',
      Description:
        'Cold-traffic ads should not use personal headshots unless this setting is enabled.',
      CreatedAt:
        now,
      UpdatedAt:
        now,
      BrandLibraryVersion:
        M4_BRAND_LIBRARY.VERSION
    }
  ];

  rules.forEach(rule =>
    m4_upsertObject_(
      rulesSheet,
      'RuleID',
      rule
    )
  );

  return {
    success: true,
    assets:
      assets.length,
    colors:
      colors.length,
    rules:
      rules.length
  };
}


/* =================================================================
   REFRESH
================================================================= */

function refreshMelroseBrandLibrary() {
  const ss =
    m4_getCommandCenter_();

  const sheet =
    m4_ensureBrandLibrarySheet_(ss);

  const records =
    m4_readObjects_(
      sheet,
      {
        includeRowNumber:
          true
      }
    );

  records.forEach(record => {
    const fileID =
      String(
        record.DriveFileID || ''
      ).trim();

    let previewURL = '';
    let status =
      record.Status || 'ACTIVE';

    if (
      fileID &&
      record.AssetType !== 'FOOTER'
    ) {
      try {
        const file =
          DriveApp.getFileById(
            fileID
          );

        previewURL =
          file.getUrl();

      } catch (error) {
        status = 'REVIEW';
      }
    }

    m4_updateObject_(
      sheet,
      record._rowNumber,
      {
        PreviewURL:
          previewURL,
        Status:
          status,
        UpdatedAt:
          new Date(),
        BrandLibraryVersion:
          M4_BRAND_LIBRARY.VERSION
      }
    );
  });

  return {
    success: true,
    checked:
      records.length
  };
}


/* =================================================================
   LOOKUP
================================================================= */

function getMelroseBrandAsset(
  assetID
) {
  const ss =
    m4_getCommandCenter_();

  const sheet =
    m4_ensureBrandLibrarySheet_(ss);

  const row =
    m4_findRow_(
      sheet,
      'BrandAssetID',
      assetID
    );

  return row
    ? m4_readRowObject_(
        sheet,
        row
      )
    : {};
}


/* =================================================================
   FORMATTING
================================================================= */

function m4_formatBrandLibrary_() {
  const ss =
    m4_getCommandCenter_();

  const library =
    m4_ensureBrandLibrarySheet_(ss);

  const colors =
    m4_ensureBrandColorsSheet_(ss);

  const rules =
    m4_ensureBrandRulesSheet_(ss);

  m4_applyBrandLibraryValidation_(
    library
  );

  [library, colors, rules]
    .forEach(sheet => {
      sheet
        .getDataRange()
        .setWrap(true)
        .setVerticalAlignment('top');
    });

  return {
    success: true
  };
}


function m4_applyBrandLibraryValidation_(
  sheet
) {
  m4_ensureRows_(
    sheet,
    Math.max(
      100,
      sheet.getLastRow() + 25
    )
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
        M4_BRAND_LIBRARY.ASSET_TYPES
      )
    );

  sheet
    .getRange(
      2,
      8,
      rows,
      1
    )
    .setDataValidation(
      m4_listValidation_(
        M4_BRAND_LIBRARY.STATUSES
      )
    );

  [
    7,
    9,
    10,
    11
  ].forEach(column =>
    m4_checkboxRange_(
      sheet.getRange(
        2,
        column,
        rows,
        1
      )
    )
  );
}


/* =================================================================
   NAVIGATION / TEST
================================================================= */

function openMelroseBrandLibrary() {
  const ss =
    m4_getCommandCenter_();

  const sheet =
    ss.getSheetByName(
      M4_BRAND_LIBRARY
        .SHEETS
        .LIBRARY
    );

  if (!sheet) {
    throw new Error(
      'AdvertisingBrandLibrary does not exist.'
    );
  }

  ss.setActiveSheet(sheet);
  sheet.getRange('A1').activate();
}


function testMelroseBrandLibrary() {
  const ss =
    m4_getCommandCenter_();

  const libraryExists =
    Boolean(
      ss.getSheetByName(
        M4_BRAND_LIBRARY
          .SHEETS
          .LIBRARY
      )
    );

  const asset =
    getMelroseBrandAsset(
      'BRAND-BUSINESS-CARD-MAIN'
    );

  const registryComponent =
    typeof getMelroseRegistryComponent ===
      'function'
      ? getMelroseRegistryComponent(
          'ENGINE.BRAND_LIBRARY'
        )
      : {};

  return {
    success:
      libraryExists &&
      asset.BrandAssetID ===
        'BRAND-BUSINESS-CARD-MAIN' &&
      registryComponent.ComponentKey ===
        'ENGINE.BRAND_LIBRARY',
    version:
      M4_BRAND_LIBRARY.VERSION,
    libraryExists,
    businessCardAsset:
      asset.BrandAssetID || '',
    registryComponent:
      registryComponent.ComponentKey || ''
  };
}
