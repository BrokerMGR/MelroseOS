/**
 * ================================================================
 * MELROSEOS 4.0 — CAMPAIGN BUILDER
 * Version 4.0.3
 *
 * Public functions:
 * - setupMelroseCampaignBuilder()
 * - seedMelroseCampaignBuilder()
 * - createMelroseCampaign()
 * - buildSelectedCampaignCreatives()
 * - refreshMelroseCampaignBuilder()
 * - openMelroseCampaignBuilder()
 * - testMelroseCampaignBuilder()
 * ================================================================
 */

var M4_CAMPAIGN_BUILDER = Object.freeze({
  VERSION: '4.0.3',
  MODULE: 'CAMPAIGN_BUILDER',

  SHEETS: Object.freeze({
    CAMPAIGNS: 'AdvertisingCampaigns',
    CREATIVE_QUEUE: 'AdvertisingCreativeQueue',
    AUDIENCES: 'AdvertisingAudiences',
    OFFERS: 'AdvertisingOffers'
  }),

  CAMPAIGN_STATUSES: Object.freeze([
    'DRAFT',
    'READY_FOR_REVIEW',
    'APPROVED',
    'ACTIVE',
    'PAUSED',
    'COMPLETED',
    'ARCHIVED'
  ]),

  LEAD_TYPES: Object.freeze([
    'BUYER',
    'SELLER',
    'RENTER',
    'RECRUITING',
    'BRAND_GROWTH'
  ]),

  OBJECTIVES: Object.freeze([
    'LEADS',
    'TRAFFIC',
    'ENGAGEMENT',
    'AWARENESS'
  ]),

  PLATFORMS: Object.freeze([
    'FACEBOOK',
    'INSTAGRAM',
    'LINKEDIN',
    'X'
  ])
});


/* =================================================================
   SETUP
================================================================= */

function setupMelroseCampaignBuilder() {
  PropertiesService.getScriptProperties().deleteProperty(
    'M4_CAMPAIGN_SETUP_PHASE'
  );

  return continueMelroseCampaignBuilderSetup();
}


function continueMelroseCampaignBuilderSetup() {
  const properties =
    PropertiesService.getScriptProperties();

  const phase = Number(
    properties.getProperty(
      'M4_CAMPAIGN_SETUP_PHASE'
    ) || 0
  );

  const ss = m4_getCommandCenter_();

  const definitions = [
    {
      name: M4_CAMPAIGN_BUILDER.SHEETS.CAMPAIGNS,
      headers: [
        'CampaignID','CampaignName','LeadType','Objective','PrimaryPlatform',
        'AudienceID','OfferID','LandingPageURL','DailyBudget','StartDate',
        'EndDate','Status','BrokerApproved','ComplianceApproved','CreativeCount',
        'Notes','CreatedAt','CreatedBy','UpdatedAt','UpdatedBy',
        'CampaignBuilderVersion'
      ]
    },
    {
      name: M4_CAMPAIGN_BUILDER.SHEETS.CREATIVE_QUEUE,
      headers: [
        'CreativeID','CampaignID','CreativeName','AssetID','Headline','PrimaryText',
        'Description','CallToAction','LandingPageURL','Platform','Placement',
        'ComplianceStatus','BrokerApproved','ComplianceApproved','GraphicStatus',
        'PublishStatus','CreatedAt','UpdatedAt','CampaignBuilderVersion'
      ]
    },
    {
      name: M4_CAMPAIGN_BUILDER.SHEETS.AUDIENCES,
      headers: [
        'AudienceID','AudienceName','LeadType','Location','AgeMinimum','AgeMaximum',
        'Interests','Exclusions','Notes','Active','CreatedAt','UpdatedAt',
        'CampaignBuilderVersion'
      ]
    },
    {
      name: M4_CAMPAIGN_BUILDER.SHEETS.OFFERS,
      headers: [
        'OfferID','OfferName','LeadType','Headline','PrimaryText','CallToAction',
        'LandingPageURL','Active','CreatedAt','UpdatedAt','CampaignBuilderVersion'
      ]
    }
  ];

  if (phase < definitions.length) {
    const definition = definitions[phase];

    m4_campaignEnsureSheet_(
      ss,
      definition.name,
      definition.headers
    );

    properties.setProperty(
      'M4_CAMPAIGN_SETUP_PHASE',
      String(phase + 1)
    );

    m4_campaignScheduleContinuation_();

    return {
      success: true,
      complete: false,
      phaseCompleted: phase + 1,
      totalPhases: definitions.length + 2,
      sheetCompleted: definition.name,
      message: 'Setup continuation scheduled.'
    };
  }

  if (phase === definitions.length) {
    seedMelroseCampaignBuilder();

    properties.setProperty(
      'M4_CAMPAIGN_SETUP_PHASE',
      String(phase + 1)
    );

    m4_campaignScheduleContinuation_();

    return {
      success: true,
      complete: false,
      phaseCompleted: phase + 1,
      totalPhases: definitions.length + 2,
      message: 'Campaign defaults seeded. Final setup scheduled.'
    };
  }

  formatMelroseCampaignBuilder();
  registerMelroseCampaignBuilderComponents();

  m4_setSetting_(
    'CAMPAIGN_BUILDER_VERSION',
    M4_CAMPAIGN_BUILDER.VERSION,
    {
      type: 'STRING',
      category: 'MARKETING',
      description: 'Installed Campaign Builder version.',
      required: true
    }
  );

  properties.deleteProperty(
    'M4_CAMPAIGN_SETUP_PHASE'
  );

  m4_campaignDeleteContinuationTriggers_();

  return {
    success: true,
    complete: true,
    version: M4_CAMPAIGN_BUILDER.VERSION
  };
}


function m4_campaignScheduleContinuation_() {
  m4_campaignDeleteContinuationTriggers_();

  ScriptApp
    .newTrigger(
      'continueMelroseCampaignBuilderSetup'
    )
    .timeBased()
    .after(60 * 1000)
    .create();
}


function m4_campaignDeleteContinuationTriggers_() {
  ScriptApp
    .getProjectTriggers()
    .filter(trigger =>
      trigger.getHandlerFunction() ===
      'continueMelroseCampaignBuilderSetup'
    )
    .forEach(trigger => {
      try {
        ScriptApp.deleteTrigger(trigger);
      } catch (ignored) {}
    });
}


function getMelroseCampaignBuilderSetupStatus() {
  const phase = Number(
    PropertiesService
      .getScriptProperties()
      .getProperty(
        'M4_CAMPAIGN_SETUP_PHASE'
      ) || 0
  );

  return {
    success: true,
    complete: phase === 0 && Boolean(
      m4_getCommandCenter_().getSheetByName(
        M4_CAMPAIGN_BUILDER.SHEETS.OFFERS
      )
    ),
    currentPhase: phase,
    totalPhases: 6
  };
}


/* =================================================================
   DIRECT SHEET CREATION
================================================================= */

function m4_campaignEnsureSheet_(ss, sheetName, headers) {
  let sheet = m4_campaignRetry_(
    function () {
      return ss.getSheetByName(sheetName);
    },
    `Locate ${sheetName}`
  );

  if (!sheet) {
    sheet = m4_campaignRetry_(
      function () {
        return ss.insertSheet(sheetName);
      },
      `Create ${sheetName}`
    );
  }

  const requiredColumns = headers.length;

  const maxColumns = m4_campaignRetry_(
    function () {
      return sheet.getMaxColumns();
    },
    `Read columns for ${sheetName}`
  );

  if (maxColumns < requiredColumns) {
    m4_campaignRetry_(
      function () {
        sheet.insertColumnsAfter(
          maxColumns,
          requiredColumns - maxColumns
        );
      },
      `Expand ${sheetName}`
    );
  }

  const current = m4_campaignRetry_(
    function () {
      return sheet
        .getRange(1, 1, 1, requiredColumns)
        .getDisplayValues()[0]
        .map(value =>
          String(value || '').trim()
        );
    },
    `Read headers from ${sheetName}`
  );

  if (current.every(value => !value)) {
    m4_campaignRetry_(
      function () {
        sheet
          .getRange(1, 1, 1, requiredColumns)
          .setValues([headers]);
      },
      `Write headers to ${sheetName}`
    );
  } else {
    const missing = headers.filter(
      header => !current.includes(header)
    );

    if (missing.length) {
      const start = m4_campaignRetry_(
        function () {
          return sheet.getLastColumn() + 1;
        },
        `Read last column from ${sheetName}`
      );

      const needed =
        start + missing.length - 1;

      const available =
        sheet.getMaxColumns();

      if (available < needed) {
        m4_campaignRetry_(
          function () {
            sheet.insertColumnsAfter(
              available,
              needed - available
            );
          },
          `Extend ${sheetName}`
        );
      }

      m4_campaignRetry_(
        function () {
          sheet
            .getRange(
              1,
              start,
              1,
              missing.length
            )
            .setValues([missing]);
        },
        `Append headers to ${sheetName}`
      );
    }
  }

  try {
    sheet.setFrozenRows(1);
  } catch (ignored) {}

  return sheet;
}


function m4_campaignRetry_(callback, operationName) {
  let lastError = null;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return callback();
    } catch (error) {
      lastError = error;

      if (attempt < 5) {
        Utilities.sleep(
          1500 * Math.pow(2, attempt - 1)
        );
      }
    }
  }

  throw new Error(
    `${operationName || 'Campaign Builder operation'} failed. ` +
    `${lastError && lastError.message ? lastError.message : lastError}`
  );
}


/* =================================================================
   SEEDING
================================================================= */

function seedMelroseCampaignBuilder() {
  const ss = m4_getCommandCenter_();

  const audiences = ss.getSheetByName(
    M4_CAMPAIGN_BUILDER.SHEETS.AUDIENCES
  );

  const offers = ss.getSheetByName(
    M4_CAMPAIGN_BUILDER.SHEETS.OFFERS
  );

  const now = new Date();

  [
    {
      AudienceID: 'AUDIENCE-BUYER-GNO',
      AudienceName: 'Greater New Orleans Buyers',
      LeadType: 'BUYER',
      Location: 'Greater New Orleans and Northshore',
      AgeMinimum: 25,
      AgeMaximum: 65,
      Interests: 'Home buying, mortgage, real estate, relocation',
      Exclusions: 'Existing leads where available',
      Notes: '',
      Active: true,
      CreatedAt: now,
      UpdatedAt: now,
      CampaignBuilderVersion: M4_CAMPAIGN_BUILDER.VERSION
    },
    {
      AudienceID: 'AUDIENCE-SELLER-GNO',
      AudienceName: 'Greater New Orleans Sellers',
      LeadType: 'SELLER',
      Location: 'Greater New Orleans and Northshore',
      AgeMinimum: 30,
      AgeMaximum: 65,
      Interests: 'Home value, real estate, moving, relocation',
      Exclusions: 'Existing leads where available',
      Notes: '',
      Active: true,
      CreatedAt: now,
      UpdatedAt: now,
      CampaignBuilderVersion: M4_CAMPAIGN_BUILDER.VERSION
    }
  ].forEach(record => {
    m4_upsertObject_(
      audiences,
      'AudienceID',
      record
    );
  });

  [
    {
      OfferID: 'OFFER-BUYER-CONSULT',
      OfferName: 'Buyer Consultation',
      LeadType: 'BUYER',
      Headline: 'Ready to Make Your Next Move?',
      PrimaryText:
        'Get a clear homebuying plan, local guidance, and a smarter path to the right property.',
      CallToAction: 'BOOK_NOW',
      LandingPageURL:
        m4_getSetting_(
          'BOOK_NOW_URL',
          'https://melrosegrouprealty.com/book-now'
        ),
      Active: true,
      CreatedAt: now,
      UpdatedAt: now,
      CampaignBuilderVersion: M4_CAMPAIGN_BUILDER.VERSION
    },
    {
      OfferID: 'OFFER-SELLER-CONSULT',
      OfferName: 'Seller Consultation',
      LeadType: 'SELLER',
      Headline: 'Thinking About Selling?',
      PrimaryText:
        'Get a practical pricing and marketing strategy built around your property and goals.',
      CallToAction: 'BOOK_NOW',
      LandingPageURL:
        m4_getSetting_(
          'BOOK_NOW_URL',
          'https://melrosegrouprealty.com/book-now'
        ),
      Active: true,
      CreatedAt: now,
      UpdatedAt: now,
      CampaignBuilderVersion: M4_CAMPAIGN_BUILDER.VERSION
    }
  ].forEach(record => {
    m4_upsertObject_(
      offers,
      'OfferID',
      record
    );
  });

  return {
    success: true
  };
}


/* =================================================================
   CAMPAIGN CREATION
================================================================= */

function createMelroseCampaign(configuration) {
  if (
    !configuration ||
    typeof configuration !== 'object'
  ) {
    throw new Error(
      'A campaign configuration object is required.'
    );
  }

  const ss = m4_getCommandCenter_();
  const sheet = ss.getSheetByName(
    M4_CAMPAIGN_BUILDER.SHEETS.CAMPAIGNS
  );

  const campaignID =
    configuration.CampaignID ||
    m4_createID_('CAMPAIGN');

  const now = new Date();

  const record = {
    CampaignID: campaignID,
    CampaignName:
      configuration.CampaignName ||
      configuration.campaignName ||
      'New Campaign',
    LeadType:
      String(
        configuration.LeadType ||
        configuration.leadType ||
        'BUYER'
      ).toUpperCase(),
    Objective:
      String(
        configuration.Objective ||
        configuration.objective ||
        'LEADS'
      ).toUpperCase(),
    PrimaryPlatform:
      String(
        configuration.PrimaryPlatform ||
        configuration.primaryPlatform ||
        'FACEBOOK'
      ).toUpperCase(),
    AudienceID:
      configuration.AudienceID ||
      configuration.audienceID ||
      '',
    OfferID:
      configuration.OfferID ||
      configuration.offerID ||
      '',
    LandingPageURL:
      configuration.LandingPageURL ||
      configuration.landingPageURL ||
      m4_getSetting_(
        'BOOK_NOW_URL',
        'https://melrosegrouprealty.com/book-now'
      ),
    DailyBudget:
      m4_number_(
        configuration.DailyBudget ||
        configuration.dailyBudget,
        10
      ),
    StartDate:
      configuration.StartDate ||
      configuration.startDate ||
      '',
    EndDate:
      configuration.EndDate ||
      configuration.endDate ||
      '',
    Status: 'DRAFT',
    BrokerApproved: false,
    ComplianceApproved: false,
    CreativeCount: 0,
    Notes:
      configuration.Notes ||
      configuration.notes ||
      '',
    CreatedAt: now,
    CreatedBy: m4_currentUser_(),
    UpdatedAt: now,
    UpdatedBy: m4_currentUser_(),
    CampaignBuilderVersion:
      M4_CAMPAIGN_BUILDER.VERSION
  };

  m4_upsertObject_(
    sheet,
    'CampaignID',
    record
  );

  return {
    success: true,
    campaignID
  };
}


/* =================================================================
   CREATIVE BUILD
================================================================= */

function buildSelectedCampaignCreatives() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      'Open the Command Center spreadsheet first.'
    );
  }

  const campaignSheet = ss.getActiveSheet();

  if (
    campaignSheet.getName() !==
    M4_CAMPAIGN_BUILDER.SHEETS.CAMPAIGNS
  ) {
    throw new Error(
      'Open AdvertisingCampaigns and select a campaign row.'
    );
  }

  const row = campaignSheet.getActiveRange().getRow();

  if (row < 2) {
    throw new Error(
      'Select a campaign data row.'
    );
  }

  const campaign =
    m4_readRowObject_(
      campaignSheet,
      row
    );

  if (!campaign.CampaignID) {
    throw new Error(
      'The selected row does not contain a CampaignID.'
    );
  }

  const offer =
    m4_campaignLookup_(
      ss.getSheetByName(
        M4_CAMPAIGN_BUILDER.SHEETS.OFFERS
      ),
      'OfferID',
      campaign.OfferID
    );

  const assets =
    typeof getMelroseAssetByID === 'function'
      ? m4_campaignChooseAssets_(
          campaign.LeadType
        )
      : [];

  const creativeSheet = ss.getSheetByName(
    M4_CAMPAIGN_BUILDER.SHEETS.CREATIVE_QUEUE
  );

  const platforms = [
    campaign.PrimaryPlatform || 'FACEBOOK',
    campaign.PrimaryPlatform === 'FACEBOOK'
      ? 'INSTAGRAM'
      : 'FACEBOOK'
  ];

  const creatives = platforms.map(
    (platform, index) => ({
      CreativeID:
        m4_createID_('CREATIVE'),
      CampaignID:
        campaign.CampaignID,
      CreativeName:
        `${campaign.CampaignName} - ${platform} ${index + 1}`,
      AssetID:
        assets[index] || '',
      Headline:
        offer.Headline ||
        campaign.CampaignName,
      PrimaryText:
        offer.PrimaryText || '',
      Description:
        campaign.LeadType === 'BUYER'
          ? 'Local guidance for your next home purchase.'
          : 'A clear strategy for your next home sale.',
      CallToAction:
        offer.CallToAction ||
        'BOOK_NOW',
      LandingPageURL:
        campaign.LandingPageURL ||
        offer.LandingPageURL ||
        '',
      Platform:
        platform,
      Placement:
        'FEED',
      ComplianceStatus:
        'PENDING',
      BrokerApproved:
        false,
      ComplianceApproved:
        false,
      GraphicStatus:
        'NOT_STARTED',
      PublishStatus:
        'NOT_READY',
      CreatedAt:
        new Date(),
      UpdatedAt:
        new Date(),
      CampaignBuilderVersion:
        M4_CAMPAIGN_BUILDER.VERSION
    })
  );

  creatives.forEach(record => {
    m4_upsertObject_(
      creativeSheet,
      'CreativeID',
      record
    );
  });

  m4_updateObject_(
    campaignSheet,
    row,
    {
      CreativeCount:
        creatives.length,
      Status:
        'READY_FOR_REVIEW',
      UpdatedAt:
        new Date(),
      UpdatedBy:
        m4_currentUser_(),
      CampaignBuilderVersion:
        M4_CAMPAIGN_BUILDER.VERSION
    }
  );

  return {
    success: true,
    campaignID:
      campaign.CampaignID,
    creativesCreated:
      creatives.length
  };
}


function m4_campaignChooseAssets_(leadType) {
  const ss = m4_getCommandCenter_();
  const sheet = ss.getSheetByName('AdvertisingAssetLibrary');

  if (!sheet) {
    return [];
  }

  return m4_readObjects_(sheet)
    .filter(record =>
      m4_boolean_(record.Active) &&
      (
        String(record.LeadTypes || '')
          .toUpperCase()
          .includes(
            String(leadType || '').toUpperCase()
          ) ||
        String(record.LeadTypes || '')
          .toUpperCase()
          .includes('ALL')
      )
    )
    .filter(record =>
      m4_boolean_(record.HumanFaceAllowed) ||
      !m4_boolean_(record.PeoplePresent)
    )
    .map(record => record.AssetID)
    .slice(0, 2);
}


/* =================================================================
   REFRESH
================================================================= */

function refreshMelroseCampaignBuilder() {
  const ss = m4_getCommandCenter_();

  const campaignSheet = ss.getSheetByName(
    M4_CAMPAIGN_BUILDER.SHEETS.CAMPAIGNS
  );

  const creativeSheet = ss.getSheetByName(
    M4_CAMPAIGN_BUILDER.SHEETS.CREATIVE_QUEUE
  );

  const campaigns = m4_readObjects_(
    campaignSheet,
    { includeRowNumber: true }
  );

  const creatives = m4_readObjects_(
    creativeSheet
  );

  campaigns.forEach(campaign => {
    const count = creatives.filter(
      creative =>
        creative.CampaignID ===
        campaign.CampaignID
    ).length;

    m4_updateObject_(
      campaignSheet,
      campaign._rowNumber,
      {
        CreativeCount: count,
        UpdatedAt: new Date(),
        CampaignBuilderVersion:
          M4_CAMPAIGN_BUILDER.VERSION
      }
    );
  });

  return {
    success: true,
    campaigns:
      campaigns.length,
    creatives:
      creatives.length
  };
}


/* =================================================================
   FORMAT
================================================================= */

function formatMelroseCampaignBuilder() {
  const ss = m4_getCommandCenter_();

  const campaignSheet = ss.getSheetByName(
    M4_CAMPAIGN_BUILDER.SHEETS.CAMPAIGNS
  );

  const creativeSheet = ss.getSheetByName(
    M4_CAMPAIGN_BUILDER.SHEETS.CREATIVE_QUEUE
  );

  const rows = Math.max(
    50,
    campaignSheet.getLastRow() + 25
  );

  if (campaignSheet.getMaxRows() < rows + 1) {
    campaignSheet.insertRowsAfter(
      campaignSheet.getMaxRows(),
      rows + 1 - campaignSheet.getMaxRows()
    );
  }

  campaignSheet
    .getRange(2, 3, rows, 1)
    .setDataValidation(
      m4_listValidation_(
        M4_CAMPAIGN_BUILDER.LEAD_TYPES
      )
    );

  campaignSheet
    .getRange(2, 4, rows, 1)
    .setDataValidation(
      m4_listValidation_(
        M4_CAMPAIGN_BUILDER.OBJECTIVES
      )
    );

  campaignSheet
    .getRange(2, 5, rows, 1)
    .setDataValidation(
      m4_listValidation_(
        M4_CAMPAIGN_BUILDER.PLATFORMS
      )
    );

  campaignSheet
    .getRange(2, 12, rows, 1)
    .setDataValidation(
      m4_listValidation_(
        M4_CAMPAIGN_BUILDER.CAMPAIGN_STATUSES
      )
    );

  [13,14].forEach(column => {
    m4_checkboxRange_(
      campaignSheet.getRange(
        2,
        column,
        rows,
        1
      )
    );
  });

  [campaignSheet, creativeSheet].forEach(
    sheet => {
      sheet
        .getDataRange()
        .setWrap(true)
        .setVerticalAlignment('top');
    }
  );

  return {
    success: true
  };
}


/* =================================================================
   LOOKUP / REGISTRATION
================================================================= */

function m4_campaignLookup_(sheet, keyHeader, keyValue) {
  if (!sheet || !keyValue) {
    return {};
  }

  return (
    m4_readObjects_(sheet)
      .find(record =>
        String(record[keyHeader] || '') ===
        String(keyValue || '')
      ) || {}
  );
}


function registerMelroseCampaignBuilderComponents() {
  if (
    typeof registerMelroseEngine ===
    'function'
  ) {
    registerMelroseEngine({
      componentKey:
        'ENGINE.CAMPAIGN_BUILDER',
      engineName:
        'Campaign Builder',
      module:
        'MARKETING',
      version:
        M4_CAMPAIGN_BUILDER.VERSION,
      setupFunction:
        'setupMelroseCampaignBuilder',
      requiredSheet:
        M4_CAMPAIGN_BUILDER.SHEETS.CAMPAIGNS,
      required:
        true,
      description:
        'Builds advertising campaigns and creative queues.'
    });
  }

  if (
    typeof registerMelroseDependency ===
    'function'
  ) {
    [
      ['ENGINE.CORE_COMMON', true],
      ['ENGINE.CORE_SETTINGS', true],
      ['ENGINE.CORE_REGISTRY', true],
      ['ENGINE.ASSET_LIBRARY', true],
      ['ENGINE.BRAND_LIBRARY', true]
    ].forEach(item => {
      registerMelroseDependency({
        source:
          'ENGINE.CAMPAIGN_BUILDER',
        type:
          'REQUIRES',
        target:
          item[0],
        required:
          item[1],
        notes:
          'Campaign Builder dependency.'
      });
    });
  }

  return {
    success: true
  };
}


/* =================================================================
   NAVIGATION / TEST
================================================================= */

function openMelroseCampaignBuilder() {
  const ss = m4_getCommandCenter_();

  const sheet = ss.getSheetByName(
    M4_CAMPAIGN_BUILDER.SHEETS.CAMPAIGNS
  );

  if (!sheet) {
    throw new Error(
      'AdvertisingCampaigns does not exist.'
    );
  }

  ss.setActiveSheet(sheet);
  sheet.getRange('A1').activate();
}


function testMelroseCampaignBuilder() {
  const ss = m4_getCommandCenter_();

  const campaigns = Boolean(
    ss.getSheetByName(
      M4_CAMPAIGN_BUILDER.SHEETS.CAMPAIGNS
    )
  );

  const creatives = Boolean(
    ss.getSheetByName(
      M4_CAMPAIGN_BUILDER.SHEETS.CREATIVE_QUEUE
    )
  );

  const audiences = Boolean(
    ss.getSheetByName(
      M4_CAMPAIGN_BUILDER.SHEETS.AUDIENCES
    )
  );

  const offers = Boolean(
    ss.getSheetByName(
      M4_CAMPAIGN_BUILDER.SHEETS.OFFERS
    )
  );

  return {
    success:
      campaigns &&
      creatives &&
      audiences &&
      offers,
    version:
      M4_CAMPAIGN_BUILDER.VERSION,
    campaigns,
    creatives,
    audiences,
    offers
  };
}
