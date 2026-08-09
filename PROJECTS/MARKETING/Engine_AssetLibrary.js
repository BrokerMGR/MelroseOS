/**
 * ================================================================
 * MELROSEOS 4.0 — ASSET LIBRARY
 * Version 4.0.2
 *
 * Direct-sheet performance rewrite.
 * Does not call m4_ensureSheet_, m4_ensureColumns_ or m4_ensureRows_
 * during installation.
 * ================================================================
 */

var M4_ASSET_LIBRARY = Object.freeze({
  VERSION: '4.0.2',
  MODULE: 'ASSET_LIBRARY',

  SHEETS: Object.freeze({
    LIBRARY: 'AdvertisingAssetLibrary',
    COLLECTIONS: 'AdvertisingCollections',
    TAGS: 'AdvertisingTags',
    USAGE: 'AdvertisingAssetUsage'
  }),

  ASSET_TYPES: Object.freeze([
    'PHOTO','ILLUSTRATION','VIDEO','LOGO','HEADSHOT','ICON','TEMPLATE','OTHER'
  ]),

  SOURCE_MODES: Object.freeze([
    'STORED_ASSET','GENERATED','UPLOADED_ASSET','EXTERNAL'
  ]),

  ORIENTATIONS: Object.freeze([
    'SQUARE','PORTRAIT','LANDSCAPE','VERTICAL','HORIZONTAL','UNKNOWN'
  ]),

  COMPLIANCE_STATUSES: Object.freeze([
    'PENDING','PASS','REVISE','BLOCKED','EXPIRED'
  ]),

  RIGHTS_STATUSES: Object.freeze([
    'CONFIRMED','PENDING','RESTRICTED','EXPIRED'
  ]),

  DEFAULT_ROWS: 100,
  RETRIES: 5,
  RETRY_DELAY_MS: 1500
});


/* =================================================================
   SETUP
================================================================= */

function setupMelroseAssetLibrary() {
  const startedAt = Date.now();

  try {
    const result = m4_withDocumentLock_(function () {
      const ss = m4_getCommandCenter_();

      const sheets = m4_assetEnsureAllSheetsDirect_(ss);
      const seed = m4_assetSeedAllDirect_(sheets);

      try {
        m4_setSetting_(
          'ASSET_LIBRARY_VERSION',
          M4_ASSET_LIBRARY.VERSION,
          {
            type: 'STRING',
            category: 'MARKETING',
            description: 'Installed MelroseOS Asset Library version.',
            required: true
          }
        );
      } catch (ignored) {
        // Settings registration is not allowed to block sheet setup.
      }

      SpreadsheetApp.flush();

      return {
        success: true,
        version: M4_ASSET_LIBRARY.VERSION,
        sheets: Object.keys(sheets).length,
        seededAssets: seed.assets,
        seededCollections: seed.collections,
        seededTags: seed.tags
      };
    }, {
      waitMS: 5000,
      deferOnFailure: true
    });

    if (result && result.deferred) {
      return result;
    }

    try {
      m4_logActivity_({
        module: M4_ASSET_LIBRARY.MODULE,
        action: 'ASSET_LIBRARY_SETUP',
        status: 'SUCCESS',
        details: `Asset Library ${M4_ASSET_LIBRARY.VERSION} installed.`,
        durationMS: Date.now() - startedAt
      });
    } catch (ignored) {}

    return result;

  } catch (error) {
    try {
      m4_logError_(
        'setupMelroseAssetLibrary',
        error,
        M4_ASSET_LIBRARY.MODULE
      );
    } catch (ignored) {}

    throw error;
  }
}


/**
 * Run after setup succeeds.
 * Registry activity is deliberately separated from sheet creation.
 */
function registerMelroseAssetLibraryComponents() {
  if (typeof registerMelroseEngine === 'function') {
    registerMelroseEngine({
      componentKey: 'ENGINE.ASSET_LIBRARY',
      engineName: 'Asset Library',
      module: 'MARKETING',
      version: M4_ASSET_LIBRARY.VERSION,
      setupFunction: 'setupMelroseAssetLibrary',
      requiredSheet: M4_ASSET_LIBRARY.SHEETS.LIBRARY,
      required: true,
      description: 'Reusable marketing and advertising asset catalog.'
    });
  }

  if (typeof registerMelroseSheet === 'function') {
    [
      ['SHEET.ADVERTISING_ASSET_LIBRARY', M4_ASSET_LIBRARY.SHEETS.LIBRARY],
      ['SHEET.ADVERTISING_COLLECTIONS', M4_ASSET_LIBRARY.SHEETS.COLLECTIONS],
      ['SHEET.ADVERTISING_TAGS', M4_ASSET_LIBRARY.SHEETS.TAGS],
      ['SHEET.ADVERTISING_ASSET_USAGE', M4_ASSET_LIBRARY.SHEETS.USAGE]
    ].forEach(item => {
      registerMelroseSheet({
        componentKey: item[0],
        sheetName: item[1],
        componentName: item[1],
        module: 'MARKETING',
        version: M4_ASSET_LIBRARY.VERSION,
        required: true,
        description: item[1]
      });
    });
  }

  if (typeof registerMelroseDependency === 'function') {
    [
      ['ENGINE.CORE_COMMON', true],
      ['ENGINE.CORE_SETTINGS', true],
      ['ENGINE.CORE_REGISTRY', true],
      ['ENGINE.BRAND_LIBRARY', false]
    ].forEach(item => {
      registerMelroseDependency({
        source: 'ENGINE.ASSET_LIBRARY',
        type: 'REQUIRES',
        target: item[0],
        required: item[1],
        notes: 'Asset Library dependency.'
      });
    });
  }

  return {
    success: true,
    version: M4_ASSET_LIBRARY.VERSION
  };
}


/* =================================================================
   DIRECT SHEET CREATION
================================================================= */

function m4_assetEnsureAllSheetsDirect_(ss) {
  const definitions = [
    {
      key: 'library',
      name: M4_ASSET_LIBRARY.SHEETS.LIBRARY,
      headers: m4_assetLibraryHeaders_()
    },
    {
      key: 'collections',
      name: M4_ASSET_LIBRARY.SHEETS.COLLECTIONS,
      headers: m4_assetCollectionHeaders_()
    },
    {
      key: 'tags',
      name: M4_ASSET_LIBRARY.SHEETS.TAGS,
      headers: m4_assetTagHeaders_()
    },
    {
      key: 'usage',
      name: M4_ASSET_LIBRARY.SHEETS.USAGE,
      headers: m4_assetUsageHeaders_()
    }
  ];

  const existing = new Map(
    m4_assetRetry_(
      () => ss.getSheets(),
      'Read spreadsheet sheets'
    ).map(sheet => [sheet.getName(), sheet])
  );

  const output = {};

  definitions.forEach(definition => {
    let sheet = existing.get(definition.name);

    if (!sheet) {
      sheet = m4_assetRetry_(
        () => ss.insertSheet(
          definition.name,
          M4_ASSET_LIBRARY.DEFAULT_ROWS,
          definition.headers.length
        ),
        `Create ${definition.name}`
      );

      existing.set(definition.name, sheet);
    }

    m4_assetEnsureHeadersDirect_(sheet, definition.headers);
    output[definition.key] = sheet;
  });

  return output;
}


function m4_assetEnsureHeadersDirect_(sheet, expectedHeaders) {
  const existingColumns = m4_assetRetry_(
    () => sheet.getMaxColumns(),
    `Read columns for ${sheet.getName()}`
  );

  if (existingColumns < expectedHeaders.length) {
    m4_assetRetry_(
      () => sheet.insertColumnsAfter(
        existingColumns,
        expectedHeaders.length - existingColumns
      ),
      `Add columns to ${sheet.getName()}`
    );
  }

  const current = m4_assetRetry_(
    () => sheet
      .getRange(1, 1, 1, expectedHeaders.length)
      .getDisplayValues()[0]
      .map(value => String(value || '').trim()),
    `Read headers for ${sheet.getName()}`
  );

  if (current.every(value => !value)) {
    m4_assetRetry_(
      () => sheet
        .getRange(1, 1, 1, expectedHeaders.length)
        .setValues([expectedHeaders]),
      `Write headers for ${sheet.getName()}`
    );
  } else {
    const missing = expectedHeaders.filter(
      header => !current.includes(header)
    );

    if (missing.length) {
      const lastColumn = m4_assetRetry_(
        () => sheet.getLastColumn(),
        `Read last column for ${sheet.getName()}`
      );

      const targetColumns = lastColumn + missing.length;

      if (sheet.getMaxColumns() < targetColumns) {
        m4_assetRetry_(
          () => sheet.insertColumnsAfter(
            sheet.getMaxColumns(),
            targetColumns - sheet.getMaxColumns()
          ),
          `Extend ${sheet.getName()}`
        );
      }

      m4_assetRetry_(
        () => sheet
          .getRange(1, lastColumn + 1, 1, missing.length)
          .setValues([missing]),
        `Append headers for ${sheet.getName()}`
      );
    }
  }

  try {
    sheet.setFrozenRows(1);
  } catch (ignored) {}
}


/* =================================================================
   HEADERS
================================================================= */

function m4_assetLibraryHeaders_() {
  return [
    'AssetID','AssetName','AssetType','SourceMode','DriveFileID','DriveFileName',
    'PreviewURL','MimeType','FileSizeBytes','WidthPX','HeightPX','Orientation',
    'Category','LeadTypes','PropertyTypes','Parishes','Tags','CollectionIDs',
    'PeoplePresent','HumanFaceAllowed','UsageRightsStatus','UsageRightsConfirmed',
    'RightsSource','RightsExpiration','ComplianceStatus','BrokerApproved',
    'ComplianceApproved','Active','TimesUsed','LastUsedAt','PerformanceScore',
    'AverageCTR','AverageCPL','AverageCPC','CreatedAt','CreatedBy','UpdatedAt',
    'UpdatedBy','Notes','AssetLibraryVersion'
  ];
}

function m4_assetCollectionHeaders_() {
  return [
    'CollectionID','CollectionName','Description','LeadTypes','Categories','Tags',
    'PreferredOrientations','Active','AssetCount','CreatedAt','UpdatedAt',
    'AssetLibraryVersion'
  ];
}

function m4_assetTagHeaders_() {
  return [
    'TagID','TagName','TagCategory','Description','Active','TimesUsed',
    'CreatedAt','UpdatedAt','AssetLibraryVersion'
  ];
}

function m4_assetUsageHeaders_() {
  return [
    'UsageID','AssetID','CampaignID','CreativeID','Platform','Placement',
    'UsedAt','CTR','CPC','CPL','Leads','Spend','Impressions','Clicks',
    'Notes','AssetLibraryVersion'
  ];
}


/* =================================================================
   BATCH SEEDING
================================================================= */

function seedMelroseAssetLibrary() {
  const ss = m4_getCommandCenter_();
  const sheets = m4_assetEnsureAllSheetsDirect_(ss);
  return m4_assetSeedAllDirect_(sheets);
}


function m4_assetSeedAllDirect_(sheets) {
  const now = new Date();
  const user = m4_currentUser_();

  const assets = [
    {
      AssetID: 'ASSET-HEADSHOT-ULYSSES',
      AssetName: 'Ulysses Headshot',
      AssetType: 'HEADSHOT',
      SourceMode: 'UPLOADED_ASSET',
      DriveFileID: m4_getSetting_(
        'ULYSSES_HEADSHOT_FILE_ID',
        '1XREInUsxWy_2Tlw81mVGllgwJf7ytdaM'
      ),
      DriveFileName: '',
      PreviewURL: '',
      MimeType: '',
      FileSizeBytes: '',
      WidthPX: '',
      HeightPX: '',
      Orientation: 'UNKNOWN',
      Category: 'BRAND',
      LeadTypes: 'BUYER,SELLER,BRAND_GROWTH',
      PropertyTypes: '',
      Parishes: 'ALL',
      Tags: 'ULYSSES,HEADSHOT,BRAND',
      CollectionIDs: 'COLLECTION-BRAND',
      PeoplePresent: true,
      HumanFaceAllowed: false,
      UsageRightsStatus: 'CONFIRMED',
      UsageRightsConfirmed: true,
      RightsSource: 'OWNER_CONTROLLED',
      RightsExpiration: '',
      ComplianceStatus: 'PENDING',
      BrokerApproved: true,
      ComplianceApproved: false,
      Active: true,
      TimesUsed: 0,
      LastUsedAt: '',
      PerformanceScore: 0,
      AverageCTR: 0,
      AverageCPL: 0,
      AverageCPC: 0,
      CreatedAt: now,
      CreatedBy: user,
      UpdatedAt: now,
      UpdatedBy: user,
      Notes: 'Reserved for retargeting and brand-awareness campaigns.',
      AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
    },
    {
      AssetID: 'ASSET-HEADSHOT-SAMANTHA',
      AssetName: 'Samantha Headshot',
      AssetType: 'HEADSHOT',
      SourceMode: 'UPLOADED_ASSET',
      DriveFileID: m4_getSetting_(
        'SAMANTHA_HEADSHOT_FILE_ID',
        '1FP5Evu2BNdwPH2JRDtJPdKJ0CSxmXH7g'
      ),
      DriveFileName: '',
      PreviewURL: '',
      MimeType: '',
      FileSizeBytes: '',
      WidthPX: '',
      HeightPX: '',
      Orientation: 'UNKNOWN',
      Category: 'BRAND',
      LeadTypes: 'BUYER,SELLER,BRAND_GROWTH',
      PropertyTypes: '',
      Parishes: 'ALL',
      Tags: 'SAMANTHA,HEADSHOT,BRAND',
      CollectionIDs: 'COLLECTION-BRAND',
      PeoplePresent: true,
      HumanFaceAllowed: false,
      UsageRightsStatus: 'CONFIRMED',
      UsageRightsConfirmed: true,
      RightsSource: 'OWNER_CONTROLLED',
      RightsExpiration: '',
      ComplianceStatus: 'PENDING',
      BrokerApproved: true,
      ComplianceApproved: false,
      Active: true,
      TimesUsed: 0,
      LastUsedAt: '',
      PerformanceScore: 0,
      AverageCTR: 0,
      AverageCPL: 0,
      AverageCPC: 0,
      CreatedAt: now,
      CreatedBy: user,
      UpdatedAt: now,
      UpdatedBy: user,
      Notes: 'Reserved for retargeting and brand-awareness campaigns.',
      AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
    }
  ];

  const collections = [
    {
      CollectionID: 'COLLECTION-BRAND',
      CollectionName: 'Brand Assets',
      Description: 'Approved brokerage and personal brand assets.',
      LeadTypes: 'BUYER,SELLER,BRAND_GROWTH',
      Categories: 'BRAND',
      Tags: 'BRAND,HEADSHOT,LOGO',
      PreferredOrientations: 'SQUARE,PORTRAIT',
      Active: true,
      AssetCount: 2,
      CreatedAt: now,
      UpdatedAt: now,
      AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
    },
    {
      CollectionID: 'COLLECTION-BUYER',
      CollectionName: 'Buyer Campaign Assets',
      Description: 'Property and lifestyle assets for buyer campaigns.',
      LeadTypes: 'BUYER',
      Categories: 'HOME,INTERIOR,EXTERIOR',
      Tags: 'BUYER,HOME,KITCHEN',
      PreferredOrientations: 'SQUARE,PORTRAIT',
      Active: true,
      AssetCount: 0,
      CreatedAt: now,
      UpdatedAt: now,
      AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
    },
    {
      CollectionID: 'COLLECTION-SELLER',
      CollectionName: 'Seller Campaign Assets',
      Description: 'Property and presentation assets for seller campaigns.',
      LeadTypes: 'SELLER',
      Categories: 'HOME,EXTERIOR,MARKET',
      Tags: 'SELLER,HOME,VALUE',
      PreferredOrientations: 'SQUARE,PORTRAIT',
      Active: true,
      AssetCount: 0,
      CreatedAt: now,
      UpdatedAt: now,
      AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
    }
  ];

  const tags = [
    ['TAG-BUYER','BUYER','LEAD_TYPE'],
    ['TAG-SELLER','SELLER','LEAD_TYPE'],
    ['TAG-LUXURY','LUXURY','PROPERTY'],
    ['TAG-WATERFRONT','WATERFRONT','PROPERTY'],
    ['TAG-KITCHEN','KITCHEN','ROOM'],
    ['TAG-LIVING','LIVING_ROOM','ROOM'],
    ['TAG-EXTERIOR','EXTERIOR','PROPERTY'],
    ['TAG-BRAND','BRAND','BRANDING'],
    ['TAG-MILITARY','MILITARY_RELOCATION','AUDIENCE'],
    ['TAG-NORTHSHORE','NORTHSHORE','LOCATION'],
    ['TAG-SOUTHSHORE','SOUTHSHORE','LOCATION']
  ].map(item => ({
    TagID: item[0],
    TagName: item[1],
    TagCategory: item[2],
    Description: '',
    Active: true,
    TimesUsed: 0,
    CreatedAt: now,
    UpdatedAt: now,
    AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
  }));

  m4_assetUpsertBatchDirect_(sheets.library, 'AssetID', assets);
  m4_assetUpsertBatchDirect_(sheets.collections, 'CollectionID', collections);
  m4_assetUpsertBatchDirect_(sheets.tags, 'TagID', tags);

  return {
    success: true,
    assets: assets.length,
    collections: collections.length,
    tags: tags.length
  };
}


function m4_assetUpsertBatchDirect_(sheet, primaryKey, incoming) {
  const headers = m4_assetHeadersDirect_(sheet);

  const current = m4_assetReadRecordsDirect_(
    sheet,
    primaryKey
  );

  const map = new Map();

  current.forEach(record => {
    const key = String(record[primaryKey] || '').trim();
    if (key) map.set(key, record);
  });

  incoming.forEach(record => {
    const key = String(record[primaryKey] || '').trim();
    if (!key) return;

    map.set(
      key,
      Object.assign({}, map.get(key) || {}, record)
    );
  });

  const output = Array.from(map.values());
  m4_assetReplaceAllDirect_(sheet, headers, output);

  return {
    success: true,
    records: output.length
  };
}


/* =================================================================
   ADD / LOOKUP
================================================================= */

function addMelroseAsset(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('An asset configuration object is required.');
  }

  const ss = m4_getCommandCenter_();
  const sheets = m4_assetEnsureAllSheetsDirect_(ss);
  const now = new Date();
  const assetID =
    config.AssetID ||
    config.assetID ||
    m4_createID_('ASSET');

  const record = {
    AssetID: assetID,
    AssetName: config.AssetName || config.assetName || 'Unnamed Asset',
    AssetType: String(config.AssetType || config.assetType || 'PHOTO').toUpperCase(),
    SourceMode: String(config.SourceMode || config.sourceMode || 'UPLOADED_ASSET').toUpperCase(),
    DriveFileID: config.DriveFileID || config.driveFileID || '',
    DriveFileName: '',
    PreviewURL: '',
    MimeType: '',
    FileSizeBytes: '',
    WidthPX: '',
    HeightPX: '',
    Orientation: 'UNKNOWN',
    Category: config.Category || config.category || '',
    LeadTypes: config.LeadTypes || config.leadTypes || '',
    PropertyTypes: config.PropertyTypes || config.propertyTypes || '',
    Parishes: config.Parishes || config.parishes || '',
    Tags: config.Tags || config.tags || '',
    CollectionIDs: config.CollectionIDs || config.collectionIDs || '',
    PeoplePresent: m4_boolean_(config.PeoplePresent || config.peoplePresent),
    HumanFaceAllowed: m4_boolean_(config.HumanFaceAllowed || config.humanFaceAllowed),
    UsageRightsStatus: String(config.UsageRightsStatus || 'PENDING').toUpperCase(),
    UsageRightsConfirmed: m4_boolean_(config.UsageRightsConfirmed),
    RightsSource: config.RightsSource || '',
    RightsExpiration: config.RightsExpiration || '',
    ComplianceStatus: String(config.ComplianceStatus || 'PENDING').toUpperCase(),
    BrokerApproved: m4_boolean_(config.BrokerApproved),
    ComplianceApproved: m4_boolean_(config.ComplianceApproved),
    Active: config.Active === false ? false : true,
    TimesUsed: 0,
    LastUsedAt: '',
    PerformanceScore: 0,
    AverageCTR: 0,
    AverageCPL: 0,
    AverageCPC: 0,
    CreatedAt: now,
    CreatedBy: m4_currentUser_(),
    UpdatedAt: now,
    UpdatedBy: m4_currentUser_(),
    Notes: config.Notes || '',
    AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
  };

  m4_assetUpsertBatchDirect_(
    sheets.library,
    'AssetID',
    [record]
  );

  return { success: true, assetID };
}


function getMelroseAssetByID(assetID) {
  const ss = m4_getCommandCenter_();
  const sheet = ss.getSheetByName(
    M4_ASSET_LIBRARY.SHEETS.LIBRARY
  );

  if (!sheet) return {};

  return (
    m4_assetReadRecordsDirect_(sheet, 'AssetID')
      .find(record =>
        String(record.AssetID || '').trim() ===
        String(assetID || '').trim()
      ) || {}
  );
}


/* =================================================================
   REFRESH
================================================================= */

function refreshMelroseAssetLibrary() {
  const ss = m4_getCommandCenter_();
  const sheets = m4_assetEnsureAllSheetsDirect_(ss);

  const records = m4_assetReadRecordsDirect_(
    sheets.library,
    'AssetID'
  );

  let checked = 0;
  let accessible = 0;
  let review = 0;

  const updated = records.map(record => {
    const fileID = String(record.DriveFileID || '').trim();

    if (!fileID) return record;

    checked++;

    try {
      const file = DriveApp.getFileById(fileID);
      accessible++;

      return Object.assign({}, record, {
        DriveFileName: file.getName(),
        PreviewURL: file.getUrl(),
        MimeType: file.getMimeType(),
        FileSizeBytes: file.getSize(),
        UpdatedAt: new Date(),
        UpdatedBy: m4_currentUser_(),
        AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
      });

    } catch (error) {
      review++;

      return Object.assign({}, record, {
        ComplianceStatus:
          record.ComplianceStatus === 'PASS'
            ? 'REVISE'
            : record.ComplianceStatus,
        UpdatedAt: new Date(),
        UpdatedBy: m4_currentUser_(),
        Notes: m4_truncate_(
          `${record.Notes || ''} Drive access error: ${error.message || error}`,
          500
        ),
        AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
      });
    }
  });

  m4_assetReplaceAllDirect_(
    sheets.library,
    m4_assetHeadersDirect_(sheets.library),
    updated
  );

  refreshMelroseAssetCollectionCounts();

  return {
    success: true,
    checked,
    accessible,
    review
  };
}


function refreshMelroseAssetCollectionCounts() {
  const ss = m4_getCommandCenter_();
  const sheets = m4_assetEnsureAllSheetsDirect_(ss);

  const assets = m4_assetReadRecordsDirect_(
    sheets.library,
    'AssetID'
  );

  const collections = m4_assetReadRecordsDirect_(
    sheets.collections,
    'CollectionID'
  );

  const updated = collections.map(collection => {
    const id = String(collection.CollectionID || '').trim();

    const count = assets.filter(asset =>
      String(asset.CollectionIDs || '')
        .split(',')
        .map(value => value.trim())
        .includes(id)
    ).length;

    return Object.assign({}, collection, {
      AssetCount: count,
      UpdatedAt: new Date(),
      AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
    });
  });

  m4_assetReplaceAllDirect_(
    sheets.collections,
    m4_assetHeadersDirect_(sheets.collections),
    updated
  );

  return {
    success: true,
    collections: updated.length
  };
}


/* =================================================================
   SELECTED ROW ACTIONS
================================================================= */

function approveSelectedMelroseAsset() {
  return m4_assetUpdateSelected_({
    ComplianceStatus: 'PASS',
    BrokerApproved: true,
    ComplianceApproved: true,
    Active: true
  });
}


function archiveSelectedMelroseAsset() {
  return m4_assetUpdateSelected_({
    Active: false
  });
}


function m4_assetUpdateSelected_(updates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('Open the Command Center spreadsheet first.');
  }

  const sheet = ss.getActiveSheet();

  if (
    !sheet ||
    sheet.getName() !== M4_ASSET_LIBRARY.SHEETS.LIBRARY
  ) {
    throw new Error(
      'Open AdvertisingAssetLibrary and select an asset row first.'
    );
  }

  const range = sheet.getActiveRange();

  if (!range || range.getRow() < 2) {
    throw new Error('Select a data row first.');
  }

  const row = range.getRow();
  const records = m4_assetReadRecordsDirect_(sheet, 'AssetID');
  const selected = records[row - 2];

  if (!selected || !selected.AssetID) {
    throw new Error(
      'The selected row does not contain an AssetID.'
    );
  }

  const updated = records.map((record, index) =>
    index === row - 2
      ? Object.assign({}, record, updates, {
          UpdatedAt: new Date(),
          UpdatedBy: m4_currentUser_(),
          AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
        })
      : record
  );

  m4_assetReplaceAllDirect_(
    sheet,
    m4_assetHeadersDirect_(sheet),
    updated
  );

  return {
    success: true,
    assetID: selected.AssetID
  };
}


/* =================================================================
   USAGE
================================================================= */

function logMelroseAssetUsage(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('A usage configuration object is required.');
  }

  const assetID =
    config.AssetID ||
    config.assetID ||
    '';

  if (!assetID) {
    throw new Error('AssetID is required.');
  }

  const ss = m4_getCommandCenter_();
  const sheets = m4_assetEnsureAllSheetsDirect_(ss);

  const usageRecord = {
    UsageID: m4_createID_('ASSETUSAGE'),
    AssetID: assetID,
    CampaignID: config.CampaignID || '',
    CreativeID: config.CreativeID || '',
    Platform: config.Platform || '',
    Placement: config.Placement || '',
    UsedAt: new Date(),
    CTR: m4_number_(config.CTR),
    CPC: m4_number_(config.CPC),
    CPL: m4_number_(config.CPL),
    Leads: m4_number_(config.Leads),
    Spend: m4_number_(config.Spend),
    Impressions: m4_number_(config.Impressions),
    Clicks: m4_number_(config.Clicks),
    Notes: config.Notes || '',
    AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
  };

  const usageHeaders = m4_assetHeadersDirect_(sheets.usage);
  const usageValues = usageHeaders.map(header =>
    Object.prototype.hasOwnProperty.call(usageRecord, header)
      ? usageRecord[header]
      : ''
  );

  const targetRow = Math.max(2, sheets.usage.getLastRow() + 1);

  if (sheets.usage.getMaxRows() < targetRow) {
    sheets.usage.insertRowsAfter(
      sheets.usage.getMaxRows(),
      targetRow - sheets.usage.getMaxRows()
    );
  }

  m4_assetRetry_(
    () => sheets.usage
      .getRange(targetRow, 1, 1, usageHeaders.length)
      .setValues([usageValues]),
    'Write asset usage'
  );

  const assets = m4_assetReadRecordsDirect_(
    sheets.library,
    'AssetID'
  );

  const updatedAssets = assets.map(asset =>
    String(asset.AssetID) === String(assetID)
      ? Object.assign({}, asset, {
          TimesUsed: m4_number_(asset.TimesUsed) + 1,
          LastUsedAt: new Date(),
          UpdatedAt: new Date(),
          UpdatedBy: m4_currentUser_(),
          AssetLibraryVersion: M4_ASSET_LIBRARY.VERSION
        })
      : asset
  );

  m4_assetReplaceAllDirect_(
    sheets.library,
    m4_assetHeadersDirect_(sheets.library),
    updatedAssets
  );

  return { success: true, assetID };
}


/* =================================================================
   FORMATTING
================================================================= */

function formatMelroseAssetLibrary() {
  const ss = m4_getCommandCenter_();
  const sheets = m4_assetEnsureAllSheetsDirect_(ss);

  [
    sheets.library,
    sheets.collections,
    sheets.tags,
    sheets.usage
  ].forEach(sheet => {
    try {
      sheet
        .getDataRange()
        .setWrap(true)
        .setVerticalAlignment('top');
    } catch (ignored) {}
  });

  const rows = Math.max(
    25,
    m4_assetReadRecordsDirect_(
      sheets.library,
      'AssetID'
    ).length + 25
  );

  if (sheets.library.getMaxRows() < rows + 1) {
    sheets.library.insertRowsAfter(
      sheets.library.getMaxRows(),
      rows + 1 - sheets.library.getMaxRows()
    );
  }

  sheets.library
    .getRange(2, 3, rows, 1)
    .setDataValidation(
      m4_listValidation_(M4_ASSET_LIBRARY.ASSET_TYPES)
    );

  sheets.library
    .getRange(2, 4, rows, 1)
    .setDataValidation(
      m4_listValidation_(M4_ASSET_LIBRARY.SOURCE_MODES)
    );

  sheets.library
    .getRange(2, 12, rows, 1)
    .setDataValidation(
      m4_listValidation_(M4_ASSET_LIBRARY.ORIENTATIONS)
    );

  sheets.library
    .getRange(2, 21, rows, 1)
    .setDataValidation(
      m4_listValidation_(M4_ASSET_LIBRARY.RIGHTS_STATUSES)
    );

  sheets.library
    .getRange(2, 25, rows, 1)
    .setDataValidation(
      m4_listValidation_(M4_ASSET_LIBRARY.COMPLIANCE_STATUSES)
    );

  [19,20,22,26,27,28].forEach(column => {
    m4_checkboxRange_(
      sheets.library.getRange(2, column, rows, 1)
    );
  });

  return { success: true };
}


/* =================================================================
   DIRECT DATA HELPERS
================================================================= */

function m4_assetHeadersDirect_(sheet) {
  return m4_assetRetry_(
    () => sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0]
      .map(value => String(value || '').trim()),
    `Read headers from ${sheet.getName()}`
  );
}


function m4_assetReadRecordsDirect_(sheet, primaryKey) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const values = m4_assetRetry_(
    () => sheet
      .getRange(
        1,
        1,
        sheet.getLastRow(),
        sheet.getLastColumn()
      )
      .getValues(),
    `Read records from ${sheet.getName()}`
  );

  const headers = values[0].map(
    value => String(value || '').trim()
  );

  const keyIndex = headers.indexOf(primaryKey);

  if (keyIndex < 0) {
    throw new Error(
      `${primaryKey} was not found in ${sheet.getName()}.`
    );
  }

  return values
    .slice(1)
    .map(row => {
      const key = String(row[keyIndex] || '').trim();
      if (!key) return null;

      const record = {};

      headers.forEach((header, index) => {
        if (header) record[header] = row[index];
      });

      return record;
    })
    .filter(Boolean);
}


function m4_assetReplaceAllDirect_(sheet, headers, records) {
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    m4_assetRetry_(
      () => sheet
        .getRange(2, 1, lastRow - 1, headers.length)
        .clearContent(),
      `Clear ${sheet.getName()}`
    );
  }

  if (!records.length) {
    return { success: true, written: 0 };
  }

  const values = records.map(record =>
    headers.map(header =>
      Object.prototype.hasOwnProperty.call(record, header)
        ? record[header]
        : ''
    )
  );

  if (sheet.getMaxRows() < values.length + 1) {
    m4_assetRetry_(
      () => sheet.insertRowsAfter(
        sheet.getMaxRows(),
        values.length + 1 - sheet.getMaxRows()
      ),
      `Extend rows in ${sheet.getName()}`
    );
  }

  m4_assetRetry_(
    () => sheet
      .getRange(2, 1, values.length, headers.length)
      .setValues(values),
    `Write records to ${sheet.getName()}`
  );

  return {
    success: true,
    written: values.length
  };
}


function m4_assetRetry_(callback, operationName) {
  let lastError = null;

  for (
    let attempt = 1;
    attempt <= M4_ASSET_LIBRARY.RETRIES;
    attempt++
  ) {
    try {
      return callback();
    } catch (error) {
      lastError = error;

      if (attempt < M4_ASSET_LIBRARY.RETRIES) {
        Utilities.sleep(
          M4_ASSET_LIBRARY.RETRY_DELAY_MS *
          Math.pow(2, attempt - 1)
        );
      }
    }
  }

  throw new Error(
    `${operationName || 'Spreadsheet operation'} failed after ` +
    `${M4_ASSET_LIBRARY.RETRIES} attempts. ` +
    `${lastError && lastError.message ? lastError.message : lastError}`
  );
}


/* =================================================================
   NAVIGATION / TEST
================================================================= */

function openMelroseAssetLibrary() {
  const ss = m4_getCommandCenter_();
  const sheet = ss.getSheetByName(
    M4_ASSET_LIBRARY.SHEETS.LIBRARY
  );

  if (!sheet) {
    throw new Error(
      'AdvertisingAssetLibrary does not exist.'
    );
  }

  ss.setActiveSheet(sheet);
  sheet.getRange('A1').activate();
}


function testMelroseAssetLibrary() {
  const ss = m4_getCommandCenter_();

  const libraryExists = Boolean(
    ss.getSheetByName(M4_ASSET_LIBRARY.SHEETS.LIBRARY)
  );

  const collectionsExist = Boolean(
    ss.getSheetByName(M4_ASSET_LIBRARY.SHEETS.COLLECTIONS)
  );

  const tagsExist = Boolean(
    ss.getSheetByName(M4_ASSET_LIBRARY.SHEETS.TAGS)
  );

  const usageExists = Boolean(
    ss.getSheetByName(M4_ASSET_LIBRARY.SHEETS.USAGE)
  );

  const ulysses = getMelroseAssetByID(
    'ASSET-HEADSHOT-ULYSSES'
  );

  const samantha = getMelroseAssetByID(
    'ASSET-HEADSHOT-SAMANTHA'
  );

  return {
    success:
      libraryExists &&
      collectionsExist &&
      tagsExist &&
      usageExists &&
      ulysses.AssetID === 'ASSET-HEADSHOT-ULYSSES' &&
      samantha.AssetID === 'ASSET-HEADSHOT-SAMANTHA',
    version: M4_ASSET_LIBRARY.VERSION,
    libraryExists,
    collectionsExist,
    tagsExist,
    usageExists,
    ulyssesAsset: ulysses.AssetID || '',
    samanthaAsset: samantha.AssetID || ''
  };
}
