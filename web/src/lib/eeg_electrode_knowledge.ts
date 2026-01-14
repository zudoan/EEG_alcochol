export type ElectrodeInfo = {
  name: string
  summary_vi: string
  increase_vi: string
  decrease_vi: string
  sources: { title: string; url: string; accessed: string }[]
}

const SOURCES = [
  {
    title: 'Wikipedia — International 10–20 system (EEG electrode placement)',
    url: 'https://en.wikipedia.org/wiki/10%E2%80%9320_system_(EEG)',
    accessed: '2026-01-11',
  },
  {
    title: 'Wikipedia — Frontal lobe',
    url: 'https://en.wikipedia.org/wiki/Frontal_lobe',
    accessed: '2026-01-11',
  },
  {
    title: 'Wikipedia — Motor cortex',
    url: 'https://en.wikipedia.org/wiki/Motor_cortex',
    accessed: '2026-01-11',
  },
  {
    title: 'Wikipedia — Somatosensory cortex',
    url: 'https://en.wikipedia.org/wiki/Somatosensory_cortex',
    accessed: '2026-01-11',
  },
  {
    title: 'Wikipedia — Parietal lobe',
    url: 'https://en.wikipedia.org/wiki/Parietal_lobe',
    accessed: '2026-01-11',
  },
  {
    title: 'Wikipedia — Occipital lobe',
    url: 'https://en.wikipedia.org/wiki/Occipital_lobe',
    accessed: '2026-01-11',
  },
  {
    title: 'Wikipedia — Temporal lobe',
    url: 'https://en.wikipedia.org/wiki/Temporal_lobe',
    accessed: '2026-01-11',
  },
]

function pick(...idx: number[]) {
  return idx.map((i) => SOURCES[i]).filter(Boolean)
}

export const ELECTRODE_INFO: Record<string, ElectrodeInfo> = {
  FP1: {
    name: 'FP1',
    summary_vi: 'Vùng trước trán trái (prefrontal). Thường liên quan chú ý, điều hành hành vi và kiểm soát nhận thức.',
    increase_vi: 'Tăng hoạt động vùng trước trán thường xuất hiện khi tăng yêu cầu chú ý/điều hành; EEG vùng trán cũng dễ bị ảnh hưởng bởi nháy mắt/EMG.',
    decrease_vi: 'Giảm hoạt động/dao động đặc trưng có thể liên quan giảm chú ý hoặc thay đổi trạng thái tỉnh táo (tuỳ bối cảnh).',
    sources: pick(0, 1),
  },
  FP2: {
    name: 'FP2',
    summary_vi: 'Vùng trước trán phải (prefrontal). Thường liên quan chú ý, kiểm soát nhận thức và điều hòa cảm xúc.',
    increase_vi: 'Tăng hoạt động có thể gặp khi nhiệm vụ đòi hỏi tập trung/căng thẳng; cần cảnh giác nhiễu cơ mặt và nháy mắt.',
    decrease_vi: 'Giảm hoạt động có thể phản ánh giảm mức tham gia nhiệm vụ hoặc thay đổi trạng thái tỉnh táo.',
    sources: pick(0, 1),
  },
  FZ: {
    name: 'FZ',
    summary_vi: 'Đường giữa thùy trán (frontal midline). Hay dùng để quan sát hoạt động liên quan chú ý/kiểm soát nhận thức.',
    increase_vi: 'Tăng hoạt động vùng trán giữa thường gặp khi tăng tải nhận thức (cognitive control) tùy nhiệm vụ.',
    decrease_vi: 'Giảm có thể xuất hiện khi thư giãn hoặc giảm yêu cầu nhiệm vụ.',
    sources: pick(0, 1),
  },
  C3: {
    name: 'C3',
    summary_vi: 'Vùng trung tâm trái (central), gần vỏ vận động/cảm giác thân thể bên phải.',
    increase_vi: 'Tăng hoạt động liên quan vận động/cảm giác (hoặc chuẩn bị vận động) tùy bối cảnh; có thể nhạy với nhiễu cơ.',
    decrease_vi: 'Giảm có thể gặp khi nghỉ hoặc khi không có hoạt động vận động/cảm giác rõ.',
    sources: pick(0, 2, 3),
  },
  C4: {
    name: 'C4',
    summary_vi: 'Vùng trung tâm phải (central), gần vỏ vận động/cảm giác thân thể bên trái.',
    increase_vi: 'Tăng có thể liên quan vận động/cảm giác hoặc nhiễu cơ vùng đầu.',
    decrease_vi: 'Giảm có thể gặp khi nghỉ hoặc ít vận động.',
    sources: pick(0, 2, 3),
  },
  CZ: {
    name: 'CZ',
    summary_vi: 'Đường giữa vùng trung tâm, nằm gần vùng vận động/cảm giác thân thể hai bên.',
    increase_vi: 'Có thể tăng khi nhiệm vụ vận động/chuẩn bị vận động; cũng có thể phản ánh nhiễu cơ.',
    decrease_vi: 'Giảm khi nghỉ hoặc khi tín hiệu ít thành phần liên quan vận động.',
    sources: pick(0, 2, 3),
  },
  PZ: {
    name: 'PZ',
    summary_vi: 'Đường giữa thùy đỉnh (parietal). Hay liên quan xử lý cảm giác, chú ý không gian, tích hợp thông tin.',
    increase_vi: 'Tăng có thể liên quan tăng xử lý chú ý/cảm giác tùy nhiệm vụ.',
    decrease_vi: 'Giảm có thể gặp khi thư giãn hoặc giảm yêu cầu xử lý.',
    sources: pick(0, 4),
  },
  O1: {
    name: 'O1',
    summary_vi: 'Thùy chẩm trái (occipital), vùng thị giác. Hay thấy alpha rõ ở vùng chẩm khi nhắm mắt/thư giãn.',
    increase_vi: 'Khi nhắm mắt/thư giãn, alpha vùng chẩm thường tăng; khi nhìn/hoạt động thị giác có thể thay đổi.',
    decrease_vi: 'Khi mở mắt/tập trung thị giác, alpha chẩm thường giảm.',
    sources: pick(0, 5),
  },
  O2: {
    name: 'O2',
    summary_vi: 'Thùy chẩm phải (occipital), vùng thị giác. Tương tự O1.',
    increase_vi: 'Nhắm mắt/thư giãn thường làm alpha vùng chẩm tăng.',
    decrease_vi: 'Mở mắt/tập trung thị giác thường làm alpha giảm.',
    sources: pick(0, 5),
  },
  T7: {
    name: 'T7',
    summary_vi: 'Thùy thái dương trái (temporal). Thường liên quan thính giác/ngôn ngữ và trí nhớ tùy bối cảnh.',
    increase_vi: 'Tăng có thể liên quan hoạt động thính giác/ngôn ngữ hoặc nhiễu cơ vùng thái dương (nhai, nói).',
    decrease_vi: 'Giảm có thể gặp khi ít hoạt động liên quan thính giác/ngôn ngữ.',
    sources: pick(0, 6),
  },
  T8: {
    name: 'T8',
    summary_vi: 'Thùy thái dương phải (temporal). Thường liên quan thính giác và một số xử lý cảm xúc/nhận diện tuỳ bối cảnh.',
    increase_vi: 'Tăng có thể liên quan hoạt động thính giác hoặc nhiễu cơ vùng thái dương.',
    decrease_vi: 'Giảm có thể gặp khi ít hoạt động liên quan.',
    sources: pick(0, 6),
  },

  X: {
    name: 'X',
    summary_vi:
      'Kênh ký hiệu "X" xuất hiện trong một số file của bộ dữ liệu SMNI_CMI. Đây không phải là vị trí điện cực tiêu chuẩn trong hệ 10–20/10–10.',
    increase_vi:
      'Vì không có tọa độ scalp chuẩn cho kênh này, nên không diễn giải theo “vùng não” như FP/F/C/P/O. Khi phân tích nên xem đây là kênh đặc biệt của dataset.',
    decrease_vi:
      'Tương tự: không nên gán trực tiếp ý nghĩa y học theo vùng. Nếu thấy ảnh hưởng lớn trong feature, nên kiểm tra lại file nguồn và schema kênh.',
    sources: pick(0),
  },
  Y: {
    name: 'Y',
    summary_vi:
      'Kênh ký hiệu "Y" xuất hiện trong một số file của bộ dữ liệu SMNI_CMI. Đây không phải là vị trí điện cực tiêu chuẩn trong hệ 10–20/10–10.',
    increase_vi:
      'Không có tọa độ scalp chuẩn để gán vào vùng não cụ thể; xem như kênh đặc biệt của dataset khi đọc feature.',
    decrease_vi:
      'Không nên diễn giải theo vùng. Nếu cần, hãy đối chiếu với tài liệu mô tả dữ liệu và các cột trong CSV.',
    sources: pick(0),
  },
  ND: {
    name: 'ND',
    summary_vi:
      'Kênh "ND" (thường viết trong feature là "nd") xuất hiện trong dataset. Đây không phải là điện cực 10–20 tiêu chuẩn, có thể là nhãn/kênh đặc thù của file.',
    increase_vi:
      'Không diễn giải theo vùng não. Nếu "ND" nổi bật trong feature bandpower, hãy coi đây là tín hiệu/kênh đặc biệt và kiểm tra lại file CSV gốc.',
    decrease_vi:
      'Tương tự: không gán trực tiếp ý nghĩa y học theo vùng. Có thể ẩn/loại khỏi phân tích scalp nếu cần độ chính xác vị trí.',
    sources: pick(0),
  },
}

function regionOfElectrode(k: string) {
  const name = String(k || '').toUpperCase()
  if (name.startsWith('FP') || name.startsWith('AF') || name.startsWith('F')) return 'frontal'
  if (name.startsWith('FC') || name.startsWith('C')) return 'central'
  if (name.startsWith('CP') || name.startsWith('P')) return 'parietal'
  if (name.startsWith('PO') || name.startsWith('O')) return 'occipital'
  if (name.startsWith('FT') || name.startsWith('T') || name.startsWith('TP')) return 'temporal'
  return 'other'
}

function fallbackInfo(name: string): ElectrodeInfo {
  const k = String(name || '').toUpperCase()
  const region = regionOfElectrode(k)

  if (region === 'frontal') {
    return {
      name: k,
      summary_vi:
        'Nhóm điện cực vùng trán (frontal). Thường liên quan chú ý, kiểm soát nhận thức, lập kế hoạch và điều hành hành vi (tuỳ vị trí trái/phải/đường giữa).',
      increase_vi:
        'Tăng hoạt động có thể liên quan tăng tải nhận thức/chú ý hoặc căng thẳng. Vùng trán cũng dễ bị ảnh hưởng bởi nháy mắt và nhiễu cơ mặt.',
      decrease_vi:
        'Giảm hoạt động có thể gặp khi thư giãn/giảm yêu cầu nhiệm vụ hoặc thay đổi mức tỉnh táo (tuỳ bối cảnh đo).',
      sources: pick(0, 1),
    }
  }

  if (region === 'central') {
    return {
      name: k,
      summary_vi:
        'Nhóm điện cực vùng trung tâm (central/rolandic). Gần vùng vỏ vận động và cảm giác thân thể (tuỳ vị trí trái/phải/đường giữa).',
      increase_vi:
        'Tăng hoạt động có thể liên quan vận động/chuẩn bị vận động hoặc phản ứng cảm giác; cũng có thể bị nhiễu bởi EMG vùng đầu/cổ.',
      decrease_vi:
        'Giảm hoạt động có thể gặp khi nghỉ/ngừng vận động hoặc ít kích thích cảm giác.',
      sources: pick(0, 2, 3),
    }
  }

  if (region === 'parietal') {
    return {
      name: k,
      summary_vi:
        'Nhóm điện cực vùng đỉnh (parietal/centro-parietal). Thường liên quan tích hợp cảm giác, chú ý không gian và xử lý thông tin đa giác quan.',
      increase_vi:
        'Tăng hoạt động có thể liên quan tăng xử lý chú ý/cảm giác hoặc yêu cầu nhiệm vụ (tuỳ bối cảnh).',
      decrease_vi:
        'Giảm hoạt động có thể gặp khi thư giãn hoặc giảm yêu cầu xử lý cảm giác/chú ý.',
      sources: pick(0, 4),
    }
  }

  if (region === 'occipital') {
    return {
      name: k,
      summary_vi:
        'Nhóm điện cực vùng chẩm (occipital/parieto-occipital). Liên quan xử lý thị giác; alpha vùng chẩm thường nổi bật khi nhắm mắt/thư giãn.',
      increase_vi:
        'Alpha chẩm thường tăng khi nhắm mắt/thư giãn; hoạt động thị giác có thể thay đổi phổ tần theo trạng thái.',
      decrease_vi:
        'Khi mở mắt/tập trung thị giác, alpha vùng chẩm thường giảm.',
      sources: pick(0, 5),
    }
  }

  if (region === 'temporal') {
    return {
      name: k,
      summary_vi:
        'Nhóm điện cực vùng thái dương (temporal/temporo-parietal). Thường liên quan thính giác, ngôn ngữ và trí nhớ (tuỳ bên trái/phải).',
      increase_vi:
        'Tăng hoạt động có thể liên quan xử lý thính giác/ngôn ngữ hoặc nhiễu cơ (nhai, nói) vùng thái dương.',
      decrease_vi:
        'Giảm hoạt động có thể gặp khi ít hoạt động thính giác/ngôn ngữ hoặc thay đổi trạng thái.',
      sources: pick(0, 6),
    }
  }

  return {
    name: k,
    summary_vi: 'Điện cực EEG theo hệ 10–20/10–10. Thông tin chi tiết có thể phụ thuộc vị trí cụ thể và bối cảnh thí nghiệm.',
    increase_vi: 'Tăng hoạt động có thể phản ánh tăng tham gia nhiệm vụ hoặc nhiễu (EMG/EOG) tuỳ vùng đo.',
    decrease_vi: 'Giảm hoạt động có thể gặp khi thư giãn/ít kích thích hoặc thay đổi mức tỉnh táo.',
    sources: pick(0),
  }
}

export function electrodeInfo(name: string): ElectrodeInfo | null {
  const k = String(name || '').toUpperCase()
  return ELECTRODE_INFO[k] || fallbackInfo(k)
}
