import { createSignal, onCleanup } from 'solid-js'
import { SearchOutlined } from '@ant-design/icons-svg'
import { searchText, setSearchText } from '../store'
import { AntIcon } from './AntIcon'

export function SearchBar(props: { initial?: string }) {
  const [input, setInput] = createSignal(props.initial ?? searchText())
  let timer: ReturnType<typeof setTimeout> | null = null

  const onInput = (e: Event) => {
    const v = (e.currentTarget as HTMLInputElement).value
    setInput(v)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => setSearchText(v), 300)
  }

  onCleanup(() => { if (timer) clearTimeout(timer) })

  return (
    <div class="flex items-center gap-1.5 h-8 px-2 glass rounded-lg w-full min-w-0">
      <AntIcon icon={SearchOutlined} class="text-gray-400" />
      <input
        value={input()}
        onInput={onInput}
        placeholder="搜索设定名称或描述"
        class="bg-transparent outline-none text-sm w-full"
      />
    </div>
  )
}
