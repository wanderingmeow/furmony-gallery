// Data model

export interface ColorVo {
  colorId?: number
  harmonyColor?: { colorName?: string }
}

export interface PainterVo {
  painterid: number
  painterName?: string
  avatarPhoto?: string
  desc?: string
  level?: number
}

export interface RaceVo {
  raceId?: number
  raceName?: string
}

export interface DetailVo {
  detailPicture?: string
}

export interface AdoptListing {
  adoptId: number
  adoptName?: string
  paintersId: number
  productId: number
  adoptPicture?: string
  adoptHeadPicture?: string
  raceId?: number
  allcost?: number
  earnest?: number
  nonrecurringExpense?: number
  status?: number // 1 = adopted
  isShow?: number
  isLock?: number // 2 = locked
  detailDescription?: string
  createBy?: string
  createTime?: string // "yyyy-MM-dd HH:mm:ss"
  updateBy?: string
  updateTime?: string
  remark?: string
  harmonyAdoptDetails?: DetailVo[]
  harmonyAdoptColorVos?: ColorVo[]
  harmonyPainterVo?: PainterVo
  harmonyRace?: RaceVo
}

export interface AdoptListResponse {
  total: number
  rows: AdoptListing[]
  code: number
  msg: string
}
