// Copyright 2017-2025 @polkadot/app-parachains authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ParaId } from '@polkadot/types/interfaces';

import React, { useState } from 'react';

import { Button, InputAddress, Modal, TxButton } from '@polkadot/react-components';
import { useAccounts, useApi, useToggle } from '@polkadot/react-hooks';

import { useTranslation } from '../translate.js';

interface Props {
  className?: string;
  paraId: ParaId;
}

function Refund ({ className, paraId }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { api } = useApi();
  const { hasAccounts } = useAccounts();
  const [isOpen, toggleOpen] = useToggle();
  const [accountId, setAccountId] = useState<string | null>(null);

  return (
    <>
      <Button
        icon='minus'
        isDisabled={!hasAccounts}
        label={t('Refund')}
        onClick={toggleOpen}
      />
      {isOpen && (
        <Modal
          className={className}
          header={t('Withdraw from fund')}
          onClose={toggleOpen}
          size='large'
        >
          <Modal.Content>
            <Modal.Columns hint={t('This account will be used to send the transaction.')}>
              <InputAddress
                label={t('requesting from')}
                onChange={setAccountId}
                type='account'
                value={accountId}
              />
            </Modal.Columns>
          </Modal.Content>
          <Modal.Actions>
            <TxButton
              accountId={accountId}
              icon='credit-card'
              label={t('Refund')}
              onStart={toggleOpen}
              params={[paraId]}
              tx={api.tx.crowdloan.refund}
            />
          </Modal.Actions>
        </Modal>
      )}
    </>
  );
}

export default React.memo(Refund);
