/**
 * MelroseOS Enterprise Core
 * File: CORE-02_Constants.gs
 * Release: MOS5-CORE-02
 * Version: 1.0.0
 * Purpose: Shared immutable constants and enums.
 */

const MGR_CONST = Object.freeze({
  YES: 'YES',
  NO: 'NO',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',

  STATUS: Object.freeze({
    NEW: 'NEW',
    IN_REVIEW: 'IN_REVIEW',
    BROKER_REVIEW: 'BROKER_REVIEW',
    COMPLETED: 'COMPLETED',
    OVERRIDDEN: 'OVERRIDDEN',
    ARCHIVED: 'ARCHIVED',
    ERROR: 'ERROR'
  }),

  LEAD_STATUS: Object.freeze({
    NEW: 'NEW',
    ROUTED: 'ROUTED',
    ASSIGNED: 'ASSIGNED',
    CONTACTED: 'CONTACTED',
    NURTURE: 'NURTURE',
    APPOINTMENT: 'APPOINTMENT',
    CLIENT: 'CLIENT',
    CLOSED: 'CLOSED',
    LOST: 'LOST',
    UNSUBSCRIBED: 'UNSUBSCRIBED',
    DO_NOT_CONTACT: 'DO_NOT_CONTACT',
    ARCHIVED: 'ARCHIVED'
  }),

  LEAD_TYPE: Object.freeze({
    BUYER: 'BUYER',
    SELLER: 'SELLER',
    RENTER: 'RENTER',
    RECRUITING: 'RECRUITING'
  }),

  ROUTE: Object.freeze({
    BROKER_ONLY: 'BROKER_ONLY',
    BROKER_DIRECT: 'BROKER_DIRECT',
    BROKER_FALLBACK: 'BROKER_FALLBACK',
    LEAD_LOCK: 'LEAD_LOCK',
    ROUND_ROBIN: 'ROUND_ROBIN',
    MANUAL: 'MANUAL'
  }),

  AGENT_STATUS: Object.freeze({
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    OFFBOARDED: 'OFFBOARDED',
    SUSPENDED: 'SUSPENDED'
  }),

  COMPLIANCE: Object.freeze({
    NEW: 'NEW',
    IN_REVIEW: 'IN_REVIEW',
    BROKER_REVIEW: 'BROKER_REVIEW',
    COMPLETED: 'COMPLETED',
    OVERRIDDEN: 'OVERRIDDEN',
    ARCHIVED: 'ARCHIVED'
  }),

  CONSULTATION: Object.freeze({
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    RESCHEDULE_REQUESTED: 'RESCHEDULE_REQUESTED',
    CANCELLED: 'CANCELLED',
    COMPLETED: 'COMPLETED'
  }),

  SOURCE: Object.freeze({
    WEBSITE: 'WEBSITE',
    BOOK_NOW: 'BOOK_NOW',
    CLEVER: 'CLEVER',
    MANUAL: 'MANUAL',
    RECRUITING: 'RECRUITING',
    IMPORT: 'IMPORT'
  }),

  PRIORITY: Object.freeze({
    LOW: 'LOW',
    NORMAL: 'NORMAL',
    HIGH: 'HIGH',
    URGENT: 'URGENT'
  }),

  RESULT: Object.freeze({
    PASS: 'PASS',
    FAIL: 'FAIL',
    WARN: 'WARN'
  })
});

function MGR_constant(path) {
  if (!path) {
    return JSON.parse(JSON.stringify(MGR_CONST));
  }

  return String(path).split('.').reduce(function (node, key) {
    if (
      node === undefined ||
      node === null ||
      !Object.prototype.hasOwnProperty.call(node, key)
    ) {
      throw new Error('Unknown MelroseOS constant: ' + path);
    }

    return node[key];
  }, MGR_CONST);
}

function MGR_isKnownLeadType(value) {
  return Object.keys(MGR_CONST.LEAD_TYPE).some(function (key) {
    return MGR_CONST.LEAD_TYPE[key] === value;
  });
}

function MGR_isTerminalLeadStatus(value) {
  return [
    MGR_CONST.LEAD_STATUS.CLOSED,
    MGR_CONST.LEAD_STATUS.LOST,
    MGR_CONST.LEAD_STATUS.UNSUBSCRIBED,
    MGR_CONST.LEAD_STATUS.DO_NOT_CONTACT,
    MGR_CONST.LEAD_STATUS.ARCHIVED
  ].indexOf(value) !== -1;
}

function MGR_isActiveAgentStatus(value) {
  return value === MGR_CONST.AGENT_STATUS.ACTIVE;
}
