// Copyright 2017-2025 @polkadot/app-settings authors & contributors
// SPDX-License-Identifier: Apache-2.0

import FileSaver from 'file-saver';
import React, { useCallback, useEffect, useState } from 'react';

import { Button, Columar, Dropdown, Progress, Spinner, styled, Toggle } from '@polkadot/react-components';
import i18n from '@polkadot/react-components/i18n';
import languageCache from '@polkadot/react-components/i18n/cache';
import { useToggle } from '@polkadot/react-hooks';
import { settings } from '@polkadot/ui-settings';

import { useTranslation } from '../translate.js';
import StringInput from './StringInput.js';

type ProgressType = [[number, number, number], Record<string, [number, number, number]>];
type Strings = Record<string, string>;
type StringsMod = Record<string, Strings>;

interface Props {
  className?: string;
}

interface Option {
  text: string;
  value: string;
}

interface Defaults {
  english: StringsMod;
  keys: Option[];
  modules: Option[];
}

const cache = new Map<string, unknown>();

async function retrieveJson (url: string): Promise<any> {
  if (cache.has(url)) {
    return cache.get(url);
  }

  const json = await fetch(`locales/${url}`)
    .then((response) => response.json())
    .catch((e) => console.error(e)) as unknown;

  cache.set(url, json);

  return json || {};
}

async function retrieveEnglish (): Promise<StringsMod> {
  const paths = await retrieveJson('en/index.json') as string[];
  const strings: Strings[] = await Promise.all(paths.map((path) => retrieveJson(`en/${path}`) as Promise<Strings>));

  return strings.reduce((language: StringsMod, strings, index): StringsMod => {
    language[paths[index]] = strings;

    return language;
  }, {});
}

async function retrieveAll (): Promise<Defaults> {
  const _keys = await retrieveJson('index.json') as string[];
  const keys = _keys.filter((lng) => lng !== 'en');
  const missing = keys.filter((lng) => !languageCache[lng]);
  const english = await retrieveEnglish();
  const translations = missing.length
    ? await Promise.all(missing.map((lng) => retrieveJson(`${lng}/translation.json`)))
    : [];

  // setup the language cache
  missing.forEach((lng, index): void => {
    languageCache[lng] = translations[index] as Record<string, string>;
  });

  // fill in all empty values (useful for download, filling in)
  keys.forEach((lng): void => {
    Object.keys(english).forEach((record): void => {
      Object.keys(english[record]).forEach((key): void => {
        if (!languageCache[lng][key]) {
          languageCache[lng][key] = '';
        }
      });
    });
  });

  return {
    english,
    keys: keys.map((text) => ({ text, value: text })),
    modules: Object
      .keys(english)
      .map((text) => ({ text: text.replace('.json', '').replace('app-', 'page-'), value: text }))
      .sort((a, b) => a.text.localeCompare(b.text))
  };
}

function calcProgress (english: StringsMod, language: Strings): ProgressType {
  const breakdown: Record<string, [number, number, number]> = {};
  let done = 0;
  let total = 0;

  Object.keys(english).forEach((record): void => {
    const mod = english[record];
    const mtotal = Object.keys(mod).length;
    let mdone = 0;

    Object.keys(mod).forEach((key): void => {
      if (language[key]) {
        mdone++;
      }
    });

    done += mdone;
    total += mtotal;

    breakdown[record] = [mdone, mtotal, 0];
  });

  return [[done, total, 0], breakdown];
}

function doDownload (strings: Strings, withEmpty: boolean): void {
  const sanitized = Object.keys(strings).sort().reduce((result: Strings, key): Strings => {
    const sanitized = strings[key].trim();

    if (sanitized || withEmpty) {
      result[key] = sanitized;
    }

    return result;
  }, {});

  // eslint-disable-next-line deprecation/deprecation
  FileSaver.saveAs(
    new Blob([JSON.stringify(sanitized, null, 2)], { type: 'application/json; charset=utf-8' }),
    'translation.json'
  );
}

function progressDisplay ([done, total, _]: [number, number, number] = [0, 0, 0]): { done: number; progress: string; total: number } {
  return {
    done,
    progress: (total ? (done * 100 / total) : 100).toFixed(2),
    total
  };
}

function Translate ({ className }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const [withEmpty, toggleWithEmpty] = useToggle();
  const [{ english, keys, modules }, setDefaults] = useState<Defaults>({ english: {}, keys: [], modules: [] });
  const [lng, setLng] = useState<string>('zh');
  const [[modProgress, allProgress], setProgress] = useState<ProgressType>([[0, 0, 0], {}]);
  const [record, setRecord] = useState<string>('app-accounts.json');
  const [strings, setStrings] = useState<Strings | null>(null);

  useEffect((): void => {
    retrieveAll().then(setDefaults).catch(console.error);
  }, []);

  useEffect((): void => {
    setStrings(languageCache[lng]);
    setProgress(calcProgress(english, languageCache[lng]));
  }, [english, lng]);

  useEffect((): void => {
    setLng(
      keys.some(({ value }) => value === settings.i18nLang)
        ? settings.i18nLang
        : 'zh'
    );
  }, [keys]);

  const _setString = useCallback(
    (key: string, value: string): void => {
      setStrings((strings: Strings | null): Strings | null =>
        strings
          ? { ...strings, [key]: value }
          : null
      );

      const hasPrevVal = !!languageCache[lng][key];
      const sanitized = value.trim();

      languageCache[lng][key] = value;

      if (hasPrevVal !== !!sanitized) {
        const [progress, breakdown] = calcProgress(english, languageCache[lng]);

        setProgress(([counters]): ProgressType => {
          progress[2] = Math.max(0, progress[0] - counters[0]);

          return [progress, breakdown];
        });
      }
    },
    [english, lng]
  );

  const _doApply = useCallback(
    (): void => {
      i18n.reloadResources().catch(console.error);
    },
    []
  );

  const _onDownload = useCallback(
    () => doDownload(strings || {}, withEmpty),
    [strings, withEmpty]
  );

  if (!keys.length) {
    return <Spinner />;
  }

  return (
    <StyledMain className={className}>
      <header>
        <Columar>
          <Columar.Column>
            <div>
              <Dropdown
                isFull
                label={t('the language to display translations for')}
                onChange={setLng}
                options={keys}
                value={lng}
              />
              {t('{{done}}/{{total}}, {{progress}}% done', { replace: progressDisplay(modProgress) })}
            </div>
            <Progress
              total={modProgress[1]}
              value={modProgress[0]}
            />
          </Columar.Column>
          <Columar.Column>
            <div>
              <Dropdown
                isFull
                label={t('the module to display strings for')}
                onChange={setRecord}
                options={modules}
                value={record}
              />
              {t('{{done}}/{{total}}, {{progress}}% done', { replace: progressDisplay(allProgress[record]) })}
            </div>
            <Progress
              total={allProgress[record]?.[1]}
              value={allProgress[record]?.[0]}
            />
          </Columar.Column>
        </Columar>
      </header>
      <div className='toggleWrapper'>
        <Toggle
          label={
            withEmpty
              ? t('include all empty strings in the generated file')
              : t('do not include empty strings in the generated file')
          }
          onChange={toggleWithEmpty}
          value={withEmpty}
        />
      </div>
      <Button.Group>
        <Button
          icon='sync'
          label={t('Apply to UI')}
          onClick={_doApply}
        />
        <Button
          icon='download'
          label={t('Generate {{lng}}/translation.json', { replace: { lng } })}
          onClick={_onDownload}
        />
      </Button.Group>
      {record && strings && Object.keys(english[record]).map((key, index) =>
        <StringInput
          key={index}
          onChange={_setString}
          original={english[record][key]}
          tkey={key}
          tval={strings[key]}
        />
      )}
    </StyledMain>
  );
}

const StyledMain = styled.main`
  .ui--Column {
    display: flex;

    > div:first-child {
      flex: 1;
      text-align: right;
    }
  }

  .ui--Progress {
    margin: 0 0 0 0.25rem;
  }

  .toggleWrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.75rem;
  }
`;

export default React.memo(Translate);
