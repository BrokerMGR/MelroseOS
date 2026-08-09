/**
 * ================================================================
 * MELROSEOS 4.0 — ADVERTISING FACTORY
 * Version 4.0.2
 *
 * Public functions:
 * - setupMelroseAdvertisingFactory4()
 * - queueSelectedCampaignForAdvertising()
 * - reviewAdvertisingCreativeQueue()
 * - approveSelectedAdvertisingCreative()
 * - holdSelectedAdvertisingCreative()
 * - refreshAdvertisingFactory4()
 * - openAdvertisingCreativeQueue()
 * - testMelroseAdvertisingFactory4()
 * ================================================================
 */

var M4_AD_FACTORY = Object.freeze({
  VERSION: '4.0.2',
  MODULE: 'ADVERTISING_FACTORY_4',

  SHEETS: Object.freeze({
    CREATIVE_QUEUE: 'AdvertisingCreativeQueue',
    GRAPHIC_QUEUE: 'AdvertisingGraphicQueue',
    REVIEW_LOG: 'AdvertisingReviewLog',
    PUBLISH_QUEUE: 'AdvertisingPublishQueue'
  }),

  REVIEW_STATUSES: Object.freeze([
    'PENDING',
    'PASS',
    'REVISE',
    'HOLD',
    'BLOCKED'
  ]),

  GRAPHIC_STATUSES: Object.freeze([
    'NOT_STARTED',
    'QUEUED',
    'IN_PROGRESS',
    'READY_FOR_REVIEW',
    'APPROVED',
    'FAILED'
  ]),

  PUBLISH_STATUSES: Object.freeze([
    'NOT_READY',
    'READY',
    'SCHEDULED',
    'PUBLISHED',
    'PAUSED',
    'FAILED'
  ])
});


/* =================================================================
   SETUP
================================================================= */

function setupMelroseAdvertisingFactory4() {
  return setupMelroseAdvertisingFactory4Step1();
}


function setupMelroseAdvertisingFactory4Step1() {
  const ss = m4_getCommandCenter_();

  m4_adEnsureSheetDirect_(
    ss,
    M4_AD_FACTORY.SHEETS.GRAPHIC_QUEUE,
    [
      'GraphicQueueID','CreativeID','CampaignID','AssetID','GraphicFormat',
      'PromptMode','PromptText','StoredAssetID','OutputFileID','OutputURL',
      'GraphicStatus','ComplianceStatus','BrokerApproved','ComplianceApproved',
      'CreatedAt','UpdatedAt','Notes','AdvertisingFactoryVersion'
    ]
  );

  return {
    success: true,
    step: 1,
    nextFunction: 'setupMelroseAdvertisingFactory4Step2'
  };
}


function setupMelroseAdvertisingFactory4Step2() {
  const ss = m4_getCommandCenter_();

  m4_adEnsureSheetDirect_(
    ss,
    M4_AD_FACTORY.SHEETS.REVIEW_LOG,
    [
      'ReviewID','CreativeID','CampaignID','ReviewType','PreviousStatus',
      'NewStatus','Reason','ReviewedAt','ReviewedBy',
      'AdvertisingFactoryVersion'
    ]
  );

  return {
    success: true,
    step: 2,
    nextFunction: 'setupMelroseAdvertisingFactory4Step3'
  };
}


function setupMelroseAdvertisingFactory4Step3() {
  const ss = m4_getCommandCenter_();

  m4_adEnsureSheetDirect_(
    ss,
    M4_AD_FACTORY.SHEETS.PUBLISH_QUEUE,
    [
      'PublishQueueID','CreativeID','CampaignID','Platform','Placement',
      'PublishStatus','ScheduledAt','PublishedAt','ExternalPostID',
      'ExternalURL','CreatedAt','UpdatedAt','Notes',
      'AdvertisingFactoryVersion'
    ]
  );

  return {
    success: true,
    step: 3,
    nextFunction: 'setupMelroseAdvertisingFactory4Finalize'
  };
}


function setupMelroseAdvertisingFactory4Finalize() {
  try {
    m4_setSetting_(
      'ADVERTISING_FACTORY_4_VERSION',
      M4_AD_FACTORY.VERSION,
      {
        type: 'STRING',
        category: 'MARKETING',
        description: 'Installed Advertising Factory 4 version.',
        required: true
      }
    );
  } catch (ignored) {}

  return {
    success: true,
    version: M4_AD_FACTORY.VERSION,
    setupComplete: true
  };
}



/* =================================================================
   SHEET CREATION
================================================================= */

function m4_adEnsureSheetDirect_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = m4_adRetry_(
      () => ss.insertSheet(sheetName),
      `Create ${sheetName}`
    );

    m4_adRetry_(
      () => sheet
        .getRange(1, 1, 1, headers.length)
        .setValues([headers]),
      `Write headers for ${sheetName}`
    );

    try {
      sheet.setFrozenRows(1);
    } catch (ignored) {}

    return sheet;
  }

  const headerRange = m4_adRetry_(
    () => sheet.getRange(1, 1, 1, headers.length),
    `Open header range for ${sheetName}`
  );

  const currentHeaders = m4_adRetry_(
    () => headerRange
      .getDisplayValues()[0]
      .map(value => String(value || '').trim()),
    `Read headers for ${sheetName}`
  );

  if (currentHeaders.every(value => !value)) {
    m4_adRetry_(
      () => headerRange.setValues([headers]),
      `Write headers for ${sheetName}`
    );
  } else {
    const output = currentHeaders.slice();

    headers.forEach((header, index) => {
      if (!output[index]) {
        output[index] = header;
      }
    });

    m4_adRetry_(
      () => headerRange.setValues([output]),
      `Repair headers for ${sheetName}`
    );
  }

  try {
    sheet.setFrozenRows(1);
  } catch (ignored) {}

  return sheet;
}


function m4_adRetry_(callback, operationName) {
  let lastError = null;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return callback();
    } catch (error) {
      lastError = error;

      if (attempt < 5) {
        Utilities.sleep(
          1200 * Math.pow(2, attempt - 1)
        );
      }
    }
  }

  throw new Error(
    `${operationName || 'Spreadsheet operation'} failed after 5 attempts. ` +
    `${lastError && lastError.message ? lastError.message : lastError}`
  );
}



/* =================================================================
   QUEUE CAMPAIGN
================================================================= */

function queueSelectedCampaignForAdvertising() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      'Open the Command Center spreadsheet first.'
    );
  }

  const campaignSheet = ss.getActiveSheet();

  if (
    campaignSheet.getName() !==
    'AdvertisingCampaigns'
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

  const campaign = m4_readRowObject_(
    campaignSheet,
    row
  );

  if (!campaign.CampaignID) {
    throw new Error(
      'The selected row does not contain a CampaignID.'
    );
  }

  const creativeSheet = ss.getSheetByName(
    M4_AD_FACTORY.SHEETS.CREATIVE_QUEUE
  );

  if (!creativeSheet) {
    throw new Error(
      'AdvertisingCreativeQueue does not exist.'
    );
  }

  const creatives = m4_readObjects_(creativeSheet)
    .filter(record =>
      String(record.CampaignID || '') ===
      String(campaign.CampaignID || '')
    );

  if (!creatives.length) {
    throw new Error(
      'No creatives were found for this campaign.'
    );
  }

  const graphicSheet = ss.getSheetByName(
    M4_AD_FACTORY.SHEETS.GRAPHIC_QUEUE
  );

  let queued = 0;

  creatives.forEach(creative => {
    const existing = m4_findRow_(
      graphicSheet,
      'CreativeID',
      creative.CreativeID
    );

    if (existing) {
      return;
    }

    m4_appendObject_(
      graphicSheet,
      {
        GraphicQueueID:
          m4_createID_('GRAPHIC'),
        CreativeID:
          creative.CreativeID,
        CampaignID:
          creative.CampaignID,
        AssetID:
          creative.AssetID || '',
        GraphicFormat:
          'SQUARE',
        PromptMode:
          creative.AssetID
            ? 'STORED_ASSET'
            : 'GENERATED',
        PromptText:
          m4_adBuildPrompt_(creative, campaign),
        StoredAssetID:
          creative.AssetID || '',
        OutputFileID:
          '',
        OutputURL:
          '',
        GraphicStatus:
          'QUEUED',
        ComplianceStatus:
          'PENDING',
        BrokerApproved:
          false,
        ComplianceApproved:
          false,
        CreatedAt:
          new Date(),
        UpdatedAt:
          new Date(),
        Notes:
          '',
        AdvertisingFactoryVersion:
          M4_AD_FACTORY.VERSION
      }
    );

    queued++;
  });

  return {
    success: true,
    campaignID:
      campaign.CampaignID,
    queued
  };
}


/* =================================================================
   REVIEW ENGINE
================================================================= */

function reviewAdvertisingCreativeQueue() {
  const ss = m4_getCommandCenter_();

  const creativeSheet = ss.getSheetByName(
    M4_AD_FACTORY.SHEETS.CREATIVE_QUEUE
  );

  if (!creativeSheet) {
    throw new Error(
      'AdvertisingCreativeQueue does not exist.'
    );
  }

  const records = m4_readObjects_(
    creativeSheet,
    {
      includeRowNumber: true
    }
  );

  let passed = 0;
  let revise = 0;
  let held = 0;

  records.forEach(record => {
    const review =
      m4_adEvaluateCreative_(record);

    m4_updateObject_(
      creativeSheet,
      record._rowNumber,
      {
        ComplianceStatus:
          review.status,
        UpdatedAt:
          new Date(),
        CampaignBuilderVersion:
          record.CampaignBuilderVersion ||
          ''
      }
    );

    m4_adLogReview_(
      ss,
      record,
      review
    );

    if (review.status === 'PASS') {
      passed++;
    } else if (review.status === 'REVISE') {
      revise++;
    } else {
      held++;
    }
  });

  return {
    success: true,
    checked:
      records.length,
    passed,
    revise,
    held
  };
}


function m4_adEvaluateCreative_(record) {
  const requiredFields = [
    'Headline',
    'PrimaryText',
    'CallToAction',
    'LandingPageURL'
  ];

  const missing = requiredFields.filter(
    field =>
      !String(record[field] || '').trim()
  );

  if (missing.length) {
    return {
      status: 'REVISE',
      reason:
        `Missing required fields: ${missing.join(', ')}`
    };
  }

  if (
    !m4_isURL_(
      record.LandingPageURL
    )
  ) {
    return {
      status: 'REVISE',
      reason:
        'LandingPageURL is invalid.'
    };
  }

  const prohibited = [
    'guaranteed approval',
    'guaranteed sale',
    'no risk',
    'perfect neighborhood',
    'safe neighborhood',
    'ideal family home'
  ];

  const content = [
    record.Headline,
    record.PrimaryText,
    record.Description
  ]
    .join(' ')
    .toLowerCase();

  const matched = prohibited.find(
    phrase =>
      content.includes(phrase)
  );

  if (matched) {
    return {
      status: 'HOLD',
      reason:
        `Potential compliance language detected: ${matched}`
    };
  }

  return {
    status: 'PASS',
    reason:
      'Automated checks passed.'
  };
}


/* =================================================================
   APPROVE / HOLD
================================================================= */

function approveSelectedAdvertisingCreative() {
  return m4_adUpdateSelectedCreative_(
    'PASS',
    true,
    true,
    'Approved by broker.'
  );
}


function holdSelectedAdvertisingCreative() {
  return m4_adUpdateSelectedCreative_(
    'HOLD',
    false,
    false,
    'Placed on hold by broker.'
  );
}


function m4_adUpdateSelectedCreative_(
  status,
  brokerApproved,
  complianceApproved,
  reason
) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      'Open the Command Center spreadsheet first.'
    );
  }

  const sheet = ss.getActiveSheet();

  if (
    sheet.getName() !==
    M4_AD_FACTORY.SHEETS.CREATIVE_QUEUE
  ) {
    throw new Error(
      'Open AdvertisingCreativeQueue and select a creative row.'
    );
  }

  const row = sheet.getActiveRange().getRow();

  if (row < 2) {
    throw new Error(
      'Select a creative data row.'
    );
  }

  const record =
    m4_readRowObject_(sheet, row);

  if (!record.CreativeID) {
    throw new Error(
      'The selected row does not contain a CreativeID.'
    );
  }

  const previousStatus =
    record.ComplianceStatus || '';

  m4_updateObject_(
    sheet,
    row,
    {
      ComplianceStatus:
        status,
      BrokerApproved:
        brokerApproved,
      ComplianceApproved:
        complianceApproved,
      PublishStatus:
        status === 'PASS'
          ? 'READY'
          : 'NOT_READY',
      UpdatedAt:
        new Date()
    }
  );

  m4_adLogReview_(
    ss,
    record,
    {
      status,
      reason,
      previousStatus
    }
  );

  return {
    success: true,
    creativeID:
      record.CreativeID,
    status
  };
}


/* =================================================================
   PUBLISH QUEUE
================================================================= */

function refreshAdvertisingFactory4() {
  const ss = m4_getCommandCenter_();

  const creativeSheet = ss.getSheetByName(
    M4_AD_FACTORY.SHEETS.CREATIVE_QUEUE
  );

  const publishSheet = ss.getSheetByName(
    M4_AD_FACTORY.SHEETS.PUBLISH_QUEUE
  );

  const creatives = m4_readObjects_(
    creativeSheet
  );

  let added = 0;

  creatives
    .filter(record =>
      record.ComplianceStatus === 'PASS' &&
      m4_boolean_(record.BrokerApproved) &&
      m4_boolean_(record.ComplianceApproved)
    )
    .forEach(record => {
      const existing = m4_findRow_(
        publishSheet,
        'CreativeID',
        record.CreativeID
      );

      if (existing) {
        return;
      }

      m4_appendObject_(
        publishSheet,
        {
          PublishQueueID:
            m4_createID_('PUBLISH'),
          CreativeID:
            record.CreativeID,
          CampaignID:
            record.CampaignID,
          Platform:
            record.Platform,
          Placement:
            record.Placement,
          PublishStatus:
            'READY',
          ScheduledAt:
            '',
          PublishedAt:
            '',
          ExternalPostID:
            '',
          ExternalURL:
            '',
          CreatedAt:
            new Date(),
          UpdatedAt:
            new Date(),
          Notes:
            '',
          AdvertisingFactoryVersion:
            M4_AD_FACTORY.VERSION
        }
      );

      added++;
    });

  return {
    success: true,
    creatives:
      creatives.length,
    publishItemsAdded:
      added
  };
}


/* =================================================================
   HELPERS
================================================================= */

function m4_adBuildPrompt_(creative, campaign) {
  return [
    'Create a polished luxury real estate advertising graphic.',
    `Audience: ${campaign.LeadType || 'BUYER'}.`,
    `Headline: ${creative.Headline || ''}.`,
    `Primary message: ${creative.PrimaryText || ''}.`,
    'Use modern residential real estate imagery.',
    'Use dark navy, gold, and white.',
    'No human faces unless specifically approved.',
    'Do not alter the official logo.',
    'Include the approved Louisiana compliance footer once.'
  ].join(' ');
}


function m4_adLogReview_(ss, record, review) {
  const sheet = ss.getSheetByName(
    M4_AD_FACTORY.SHEETS.REVIEW_LOG
  );

  if (!sheet) {
    return;
  }

  m4_appendObject_(
    sheet,
    {
      ReviewID:
        m4_createID_('ADREVIEW'),
      CreativeID:
        record.CreativeID,
      CampaignID:
        record.CampaignID,
      ReviewType:
        'AUTOMATED_OR_BROKER',
      PreviousStatus:
        review.previousStatus ||
        record.ComplianceStatus ||
        '',
      NewStatus:
        review.status,
      Reason:
        review.reason || '',
      ReviewedAt:
        new Date(),
      ReviewedBy:
        m4_currentUser_(),
      AdvertisingFactoryVersion:
        M4_AD_FACTORY.VERSION
    }
  );
}


/* =================================================================
   REGISTRATION
================================================================= */

function registerMelroseAdvertisingFactory4Components() {
  if (
    typeof registerMelroseEngine ===
    'function'
  ) {
    registerMelroseEngine({
      componentKey:
        'ENGINE.ADVERTISING_FACTORY_4',
      engineName:
        'Advertising Factory 4',
      module:
        'MARKETING',
      version:
        M4_AD_FACTORY.VERSION,
      setupFunction:
        'setupMelroseAdvertisingFactory4',
      requiredSheet:
        M4_AD_FACTORY.SHEETS.GRAPHIC_QUEUE,
      required:
        true,
      description:
        'Compliance-aware advertising production and publishing queue.'
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
      ['ENGINE.BRAND_LIBRARY', true],
      ['ENGINE.ASSET_LIBRARY', true],
      ['ENGINE.CAMPAIGN_BUILDER', true],
      ['ENGINE.COMPLIANCE_GATE', false]
    ].forEach(item => {
      registerMelroseDependency({
        source:
          'ENGINE.ADVERTISING_FACTORY_4',
        type:
          'REQUIRES',
        target:
          item[0],
        required:
          item[1],
        notes:
          'Advertising Factory 4 dependency.'
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

function openAdvertisingCreativeQueue() {
  const ss = m4_getCommandCenter_();

  const sheet = ss.getSheetByName(
    M4_AD_FACTORY.SHEETS.CREATIVE_QUEUE
  );

  if (!sheet) {
    throw new Error(
      'AdvertisingCreativeQueue does not exist.'
    );
  }

  ss.setActiveSheet(sheet);
  sheet.getRange('A1').activate();
}


function testMelroseAdvertisingFactory4() {
  const ss = m4_getCommandCenter_();

  const graphicQueue = Boolean(
    ss.getSheetByName(
      M4_AD_FACTORY.SHEETS.GRAPHIC_QUEUE
    )
  );

  const reviewLog = Boolean(
    ss.getSheetByName(
      M4_AD_FACTORY.SHEETS.REVIEW_LOG
    )
  );

  const publishQueue = Boolean(
    ss.getSheetByName(
      M4_AD_FACTORY.SHEETS.PUBLISH_QUEUE
    )
  );

  return {
    success:
      graphicQueue &&
      reviewLog &&
      publishQueue,
    version:
      M4_AD_FACTORY.VERSION,
    graphicQueue,
    reviewLog,
    publishQueue
  };
}
