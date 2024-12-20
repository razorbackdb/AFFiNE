import { notify, useConfirmModal } from '@affine/component';
import { AffineOtherPageLayout } from '@affine/component/affine-other-page-layout';
import { SignInPageContainer } from '@affine/component/auth-components';
import { SignInPanel } from '@affine/core/components/sign-in';
import { AuthService } from '@affine/core/modules/cloud';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useEffect } from 'react';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';

export const SignIn = ({
  redirectUrl: redirectUrlFromProps,
}: {
  redirectUrl?: string;
}) => {
  const t = useI18n();
  const session = useService(AuthService).session;
  const navigate = useNavigate();
  const { jumpToIndex } = useNavigateHelper();
  const [searchParams] = useSearchParams();
  const { openConfirmModal } = useConfirmModal();
  const redirectUrl = redirectUrlFromProps ?? searchParams.get('redirect_uri');
  const error = searchParams.get('error');
  const action = searchParams.get('action');

  useEffect(() => {
    if (error) {
      notify.error({
        title: t['com.affine.auth.toast.title.failed'](),
        message: error,
      });
    }
  }, [error, t]);

  useEffect(() => {
    if (action === 'upgrade' || action === 'downgrade') {
      openConfirmModal({
        title: t['com.affine.minimum-client.title'](),
        description:
          t[
            `com.affine.minimum-client.${action === 'upgrade' ? 'outdated' : 'advanced'}.message`
          ](),
        confirmText:
          t[
            `com.affine.minimum-client.${action === 'upgrade' ? 'outdated' : 'advanced'}.button`
          ](),
        onConfirm: () =>
          window.open(
            BUILD_CONFIG.downloadUrl,
            '_blank',
            'noreferrer noopener'
          ),
      });
    }
  }, [action, jumpToIndex, openConfirmModal, searchParams, t]);

  const handleClose = () => {
    if (session.status$.value === 'authenticated' && redirectUrl) {
      navigate(redirectUrl, {
        replace: true,
      });
    } else {
      jumpToIndex(RouteLogic.REPLACE, {
        search: searchParams.toString(),
      });
    }
  };

  return (
    <SignInPageContainer>
      <div style={{ maxWidth: '400px', width: '100%' }}>
        <SignInPanel onClose={handleClose} />
      </div>
    </SignInPageContainer>
  );
};

export const Component = () => {
  return (
    <AffineOtherPageLayout>
      <div style={{ padding: '0 20px' }}>
        <SignIn />
      </div>
    </AffineOtherPageLayout>
  );
};
