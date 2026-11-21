import * as React from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { FormField } from '#/components/ui/form-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { SettingsSection } from '#/components/ui/settings-section'
import { PasswordInput } from '#/features/auth/password-input'
import { authClient } from '#/lib/auth-client'
import { PERSON_NAME_MAX_LENGTH } from '#/lib/person-name'
import { m } from '#/paraglide/messages'
import { updateMyNameFn } from '#/server/fn/account'
import { verifyStepUpFn } from '#/server/fn/security'
import type { Me } from '#/server/fn/me'

import { canSaveName } from './account-logic'

/**
 * Profile: the display name is editable (Enter saves, Escape reverts). The
 * email is read-only, except that agency admins can ask for a change, which
 * only applies once the new address confirms it. Saving refreshes the router, which drops the cached
 * `me`, so the navbar account menu shows the new name without a reload.
 */
export function ProfileSection({
  me,
  hasPassword,
}: {
  me: Me
  hasPassword: boolean
}) {
  const router = useRouter()
  const [saved, setSaved] = React.useState(me.user.name)
  const [draft, setDraft] = React.useState(me.user.name)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const canSave = canSaveName(draft, saved) && !pending

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) return
    const name = draft.trim()
    setPending(true)
    setError(null)
    try {
      await updateMyNameFn({ data: { name } })
      setSaved(name)
      setDraft(name)
      toast.success(m.account_name_saved())
      await router.invalidate()
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : m.account_name_failed(),
      )
    } finally {
      setPending(false)
    }
  }

  const [newEmail, setNewEmail] = React.useState('')
  const [emailPassword, setEmailPassword] = React.useState('')
  const [emailCode, setEmailCode] = React.useState('')
  const [codeOpen, setCodeOpen] = React.useState(false)
  const [emailPending, setEmailPending] = React.useState(false)
  const [emailError, setEmailError] = React.useState<string | null>(null)
  const [codeError, setCodeError] = React.useState<string | null>(null)

  // With two-factor on, the code is asked in a dialog after this click.
  function startEmailChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (me.user.twoFactorEnabled) {
      setCodeError(null)
      setCodeOpen(true)
    } else {
      void changeEmail()
    }
  }

  async function changeEmail() {
    setEmailPending(true)
    setEmailError(null)
    setCodeError(null)
    if (me.user.twoFactorEnabled) {
      try {
        await verifyStepUpFn({
          data: { code: emailCode.replace(/\s+/g, ''), kind: 'totp' },
        })
      } catch (failure) {
        setEmailPending(false)
        setCodeError(
          failure instanceof Error ? failure.message : m.account_email_failed(),
        )
        return
      }
    }
    const body = {
      newEmail: newEmail.trim(),
      callbackURL: '/account',
      currentPassword: emailPassword,
    }
    const result = await authClient.changeEmail(body)
    setEmailPending(false)
    setCodeOpen(false)
    if (result.error) {
      setEmailError(result.error.message ?? m.account_email_failed())
      return
    }
    toast.success(m.account_email_sent({ email: body.newEmail }))
    setNewEmail('')
    setEmailPassword('')
    setEmailCode('')
  }

  return (
    <SettingsSection
      id="profile"
      title={m.account_profile_title()}
      description={m.account_profile_description()}
    >
      <form
        className="grid gap-2"
        data-testid="account-name-form"
        onSubmit={(event) => void save(event)}
      >
        <Label htmlFor="account-name">{m.auth_name()}</Label>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            id="account-name"
            name="name"
            autoComplete="name"
            maxLength={PERSON_NAME_MAX_LENGTH}
            value={draft}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'account-name-error' : undefined}
            data-testid="account-name-input"
            onChange={(event) => {
              setDraft(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setDraft(saved)
                setError(null)
              }
            }}
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={!canSave}
            loading={pending}
            data-testid="account-name-save"
            className="w-full sm:w-auto"
          >
            {m.account_name_save()}
          </Button>
        </div>
        {error ? (
          <p
            id="account-name-error"
            role="alert"
            className="text-callout text-text-error"
          >
            {error}
          </p>
        ) : null}
      </form>
      <FormField
        label={m.auth_email()}
        htmlFor="account-email"
        hint={me.user.isAgencyAdmin ? undefined : m.account_email_note()}
      >
        <Input
          id="account-email"
          name="email"
          value={me.user.email}
          readOnly
          data-testid="account-email"
          className="text-text-secondary"
        />
      </FormField>
      {me.user.isAgencyAdmin ? (
        <form
          className="grid gap-4"
          data-testid="account-email-form"
          onSubmit={startEmailChange}
        >
          <FormField label={m.account_email_new()} htmlFor="account-new-email">
            <Input
              id="account-new-email"
              name="newEmail"
              type="email"
              autoComplete="email"
              required
              value={newEmail}
              disabled={emailPending}
              onChange={(event) => {
                setNewEmail(event.target.value)
                setEmailError(null)
              }}
            />
          </FormField>
          {hasPassword ? (
            <FormField
              label={m.account_email_password()}
              htmlFor="account-email-password"
            >
              <PasswordInput
                id="account-email-password"
                name="currentPassword"
                autoComplete="current-password"
                required
                value={emailPassword}
                disabled={emailPending}
                onChange={(event) => {
                  setEmailPassword(event.target.value)
                  setEmailError(null)
                }}
              />
            </FormField>
          ) : null}
          {emailError ? (
            <p role="alert" className="text-callout text-text-error">
              {emailError}
            </p>
          ) : null}
          <div>
            <Button
              type="submit"
              variant="secondary"
              loading={emailPending}
              disabled={!newEmail.trim()}
              data-testid="account-email-submit"
              className="w-full sm:w-auto"
            >
              {m.account_email_change()}
            </Button>
          </div>
        </form>
      ) : null}
      <Dialog
        open={codeOpen}
        onOpenChange={(open) => {
          if (emailPending) return
          setCodeOpen(open)
          if (!open) setEmailCode('')
        }}
      >
        <DialogContent size="sm">
          <form
            className="grid gap-4"
            data-testid="account-email-code-form"
            onSubmit={(event) => {
              event.preventDefault()
              void changeEmail()
            }}
          >
            <DialogHeader>
              <DialogTitle>{m.account_email_code_title()}</DialogTitle>
              <DialogDescription>
                {m.account_email_code_description()}
              </DialogDescription>
            </DialogHeader>
            <FormField
              label={m.auth_two_factor_code()}
              htmlFor="account-email-code"
              hint={m.auth_two_factor_code_hint()}
              error={codeError ?? undefined}
            >
              <Input
                id="account-email-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                autoFocus
                value={emailCode}
                disabled={emailPending}
                data-testid="account-email-code"
                onChange={(event) => {
                  setEmailCode(event.target.value)
                  setCodeError(null)
                }}
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="quiet"
                disabled={emailPending}
                onClick={() => {
                  setCodeOpen(false)
                  setEmailCode('')
                }}
              >
                {m.shared_cancel()}
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={emailPending}
                disabled={!emailCode.trim()}
                data-testid="account-email-code-submit"
              >
                {m.account_email_change()}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  )
}
