const INTAKE_GMAIL_READER = Object.freeze({

  VERSION: '1.0.0',

  MAX_BODY_LENGTH: 50000,

  INCLUDE_ATTACHMENTS_METADATA: true

});

function INTAKE_readGmailMessage(message) {

  const headers = {
    from: message.getFrom ? message.getFrom() : '',
    to: message.getTo ? message.getTo() : '',
    cc: message.getCc ? message.getCc() : '',
    bcc: message.getBcc ? message.getBcc() : '',
    subject: message.getSubject ? message.getSubject() : '',
    date: message.getDate ? message.getDate() : ''
  };

  const body =
    message.getPlainBody
      ? String(message.getPlainBody() || '')
      : '';

  const attachments =
    (
      INTAKE_GMAIL_READER.INCLUDE_ATTACHMENTS_METADATA &&
      message.getAttachments
    )
      ? message.getAttachments().map(function(file) {

          return {

            name:
              file.getName
                ? file.getName()
                : '',

            contentType:
              file.getContentType
                ? file.getContentType()
                : '',

            size:
              file.getBytes
                ? file.getBytes().length
                : 0

          };

        })
      : [];

  return {

    messageId:
      message.getId
        ? message.getId()
        : '',

    threadId:
      message.getThread &&
      message.getThread()
        ? message.getThread().getId()
        : '',

    from:
      headers.from,

    to:
      headers.to,

    cc:
      headers.cc,

    bcc:
      headers.bcc,

    subject:
      headers.subject,

    receivedAt:
      headers.date,

    body:
      body.substring(
        0,
        INTAKE_GMAIL_READER.MAX_BODY_LENGTH
      ),

    attachments:
      attachments,

    attachmentCount:
      attachments.length,

    readAt:
      new Date().toISOString()

  };

}

function INTAKE_readGmailThread(thread) {

  if (
    !thread ||
    typeof thread.getMessages !== 'function'
  ) {

    throw new Error(
      'Valid Gmail thread is required.'
    );

  }

  return thread
    .getMessages()
    .map(INTAKE_readGmailMessage);

}