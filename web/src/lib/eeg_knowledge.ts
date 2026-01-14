export type Citation = {
  id: string
  title: string
  url: string
  accessed: string
}

export type BandKey = 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma'

export type BandKnowledge = {
  key: BandKey
  label_vi: string
  range_hz: [number, number]
  meaning_vi: string
  caution_vi: string
  citations: string[]
}

export const EEG_CITATIONS: Citation[] = [
  {
    id: 'wiki-eeg',
    title: 'Wikipedia — Electroencephalography (EEG) (Frequency bands section)',
    url: 'https://en.wikipedia.org/wiki/Electroencephalography',
    accessed: '2026-01-11',
  },
  {
    id: 'mayo-eeg',
    title: 'Mayo Clinic — EEG (electroencephalogram)',
    url: 'https://www.mayoclinic.org/tests-procedures/eeg/about/pac-20393875',
    accessed: '2026-01-11',
  },
  {
    id: 'nibib-eeg',
    title: 'NIH NIBIB — Electroencephalography (EEG)',
    url: 'https://www.nibib.nih.gov/science-education/science-topics/electroencephalography-eeg',
    accessed: '2026-01-11',
  },
]

export const EEG_BAND_KNOWLEDGE: Record<BandKey, BandKnowledge> = {
  delta: {
    key: 'delta',
    label_vi: 'Delta',
    range_hz: [0.5, 4],
    meaning_vi:
      'Thường liên quan trạng thái ngủ sâu; trong EEG người lớn tỉnh táo, delta nổi bật có thể gợi ý buồn ngủ/giảm tỉnh táo hoặc bất thường tuỳ bối cảnh đo.',
    caution_vi:
      'Diễn giải phụ thuộc bối cảnh (tuổi, trạng thái tỉnh/ngủ, nhiễu); web chỉ mô tả ý nghĩa phổ biến, không phải chẩn đoán y khoa.',
    citations: ['wiki-eeg', 'nibib-eeg'],
  },
  theta: {
    key: 'theta',
    label_vi: 'Theta',
    range_hz: [4, 8],
    meaning_vi:
      'Hay gặp khi buồn ngủ/thư giãn; cũng liên quan một số quá trình trí nhớ và điều hướng chú ý tuỳ nhiệm vụ.',
    caution_vi:
      'Theta có thể tăng do buồn ngủ hoặc do nhiệm vụ/điều kiện đo; cần xem thêm thời điểm đo và chất lượng tín hiệu.',
    citations: ['wiki-eeg', 'nibib-eeg'],
  },
  alpha: {
    key: 'alpha',
    label_vi: 'Alpha',
    range_hz: [8, 13],
    meaning_vi:
      'Thường nổi bật khi thư giãn, đặc biệt khi nhắm mắt; giảm khi tập trung hoặc mở mắt.',
    caution_vi:
      'Alpha bị ảnh hưởng mạnh bởi việc mở/nhắm mắt và mức độ tỉnh táo; nên xem cùng PSD và time-series để tránh hiểu sai.',
    citations: ['wiki-eeg', 'nibib-eeg'],
  },
  beta: {
    key: 'beta',
    label_vi: 'Beta',
    range_hz: [13, 30],
    meaning_vi:
      'Thường liên quan trạng thái tỉnh táo/hoạt động nhận thức; đôi khi tăng trong căng thẳng hoặc kích thích.',
    caution_vi:
      'Beta có thể bị nhiễu bởi hoạt động cơ (EMG) vùng trán/thái dương; cần kiểm tra spectrogram và biên độ time-series.',
    citations: ['wiki-eeg', 'mayo-eeg'],
  },
  gamma: {
    key: 'gamma',
    label_vi: 'Gamma',
    range_hz: [30, 45],
    meaning_vi:
      'Thường mô tả hoạt động tần số cao; đôi khi liên quan xử lý thông tin nhanh tuỳ nghiên cứu.',
    caution_vi:
      'Gamma rất dễ lẫn với nhiễu cơ (EMG) và nhiễu thiết bị; vì vậy nếu gamma nổi bật, cần kiểm tra kỹ chất lượng tín hiệu.',
    citations: ['wiki-eeg', 'mayo-eeg'],
  },
}

export function parseBandFromFeature(feature: string): BandKey | null {
  const m = feature.match(/bp_(delta|theta|alpha|beta|gamma)_/i)
  if (!m) return null
  const k = m[1].toLowerCase() as BandKey
  return k
}

export function parseChannelFromFeature(feature: string): string | null {
  const m = feature.match(/bp_(?:delta|theta|alpha|beta|gamma)_([A-Za-z0-9]+)/i)
  return m?.[1] || null
}

export function citationById(id: string): Citation | null {
  return EEG_CITATIONS.find((c) => c.id === id) || null
}
