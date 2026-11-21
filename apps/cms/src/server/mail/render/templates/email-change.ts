import { m } from '#/paraglide/messages'

import { renderLayout } from '../layout.ts'
import { MailRenderError } from '../types.ts'
import type { RenderContext, RenderedMail } from '../types.ts'

import { formatUtc, loadRecipient } from './shared.ts'

/**
 * Sent to the new address. The link comes from Better Auth and is never
 * stored, so only the immediate send (which passes `url`) can build it.
 */
export async function renderVerify(
  params: Record<string, unknown>,
  ctx: RenderContext,
): Promise<RenderedMail> {
  const { locale, brand } = ctx
  await loadRecipient(params.userId, ctx.connection)
  if (typeof params.url !== 'string' || !params.url) {
    throw new MailRenderError('the confirmation link is no longer available')
  }
  const subject = m.server_mail_tpl_email_change_verify_subject({}, { locale })
  const preheader = m.server_mail_tpl_email_change_verify_preheader(
    {},
    { locale },
  )
  const { html, text } = renderLayout({
    brand,
    preheader,
    heading: subject,
    paragraphs: [m.server_mail_tpl_email_change_verify_body({}, { locale })],
    button: {
      label: m.server_mail_tpl_email_change_verify_button({}, { locale }),
      url: params.url,
    },
    footer: [m.server_mail_tpl_email_change_verify_footer({}, { locale })],
    lang: locale,
  })
  return { subject, preheader, html, text, secrets: [params.url] }
}

/** Sent to the current address when a change is requested. */
export async function renderNotice(
  params: Record<string, unknown>,
  ctx: RenderContext,
): Promise<RenderedMail> {
  const { locale, brand } = ctx
  await loadRecipient(params.userId, ctx.connection)
  const email = String(params.newEmail ?? '')
  const date = formatUtc(params.at, locale)
  const subject = m.server_mail_tpl_email_change_notice_subject({}, { locale })
  const preheader = m.server_mail_tpl_email_change_notice_preheader(
    {},
    { locale },
  )
  const { html, text } = renderLayout({
    brand,
    preheader,
    heading: subject,
    paragraphs: [
      m.server_mail_tpl_email_change_notice_body({ email, date }, { locale }),
    ],
    footer: [m.server_mail_tpl_email_change_notice_footer({}, { locale })],
    lang: locale,
  })
  return { subject, preheader, html, text, secrets: [] }
}
