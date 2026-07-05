"use client"

// Lightweight global toast store (no external state library needed).
// Call `toast({ title, description, variant })` from anywhere on the client.

import * as React from "react"
import type { ToastActionElement } from "./toast"

const TOAST_LIMIT = 4
const TOAST_REMOVE_DELAY = 4000

type ToastVariant = "default" | "success" | "error" | "warning" | "info"

type ToasterToast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  variant?: ToastVariant
  open?: boolean
}

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type Action =
  | { type: "ADD_TOAST"; toast: ToasterToast }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string }

interface State {
  toasts: ToasterToast[]
}

const listeners: Array<(state: State) => void> = []
let memoryState: State = { toasts: [] }

const timeouts = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleRemoval(toastId: string) {
  if (timeouts.has(toastId)) return
  const timeout = setTimeout(() => {
    timeouts.delete(toastId)
    dispatch({ type: "REMOVE_TOAST", toastId })
  }, TOAST_REMOVE_DELAY)
  timeouts.set(toastId, timeout)
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_TOAST":
      return { toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }
    case "DISMISS_TOAST": {
      const { toastId } = action
      if (toastId) scheduleRemoval(toastId)
      else state.toasts.forEach((t) => scheduleRemoval(t.id))
      return {
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, open: false } : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) return { toasts: [] }
      return { toasts: state.toasts.filter((t) => t.id !== action.toastId) }
  }
}

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((l) => l(memoryState))
}

type ToastInput = Omit<ToasterToast, "id">

function toast(props: ToastInput) {
  const id = genId()

  const update = (p: ToasterToast) => dispatch({ type: "ADD_TOAST", toast: { ...p, id } })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: { ...props, id, open: true },
  })

  return { id, dismiss, update }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
