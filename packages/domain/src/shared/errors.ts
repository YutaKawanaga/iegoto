/** ドメイン層の業務ルール違反。presentation 層 (tRPC errorFormatter) でエラーコードに変換される */
export class DomainError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

export class InvalidEventTimeError extends DomainError {
  constructor(message: string) {
    super('INVALID_EVENT_TIME', message)
  }
}

export class InvalidRecurrenceRuleError extends DomainError {
  constructor(message: string) {
    super('INVALID_RECURRENCE_RULE', message)
  }
}

export class InvitationExpiredError extends DomainError {
  constructor() {
    super('INVITATION_EXPIRED', '招待リンクが無効です')
  }
}
