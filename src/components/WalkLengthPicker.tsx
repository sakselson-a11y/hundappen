import { useTranslation } from 'react-i18next'
import type { WalkLength } from '../lib/types.ts'

// Val mellan kort rastning och lång promenad.
export default function WalkLengthPicker({ value, onChange }: { value: WalkLength; onChange: (v: WalkLength) => void }) {
  const { t } = useTranslation()
  return (
    <div className="segmented" role="radiogroup" aria-label={t('walk.lengthLabel')}>
      {(['short', 'long'] as const).map((length) => (
        <button
          key={length}
          type="button"
          role="radio"
          aria-checked={value === length}
          className={value === length ? 'on' : ''}
          onClick={() => onChange(length)}
        >
          {t(`walk.${length}`)}
        </button>
      ))}
    </div>
  )
}
