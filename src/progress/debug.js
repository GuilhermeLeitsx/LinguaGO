import { dayOffset, dayStr, setDayOffset } from './clock.js'

// Muda o "hoje" do app e recarrega, para todas as telas lerem a nova data
export function shiftDay(n) {
  setDayOffset(n)
  window.location.reload()
}

// Funções de debug no console do navegador (só em desenvolvimento):
//   lgDebug.advanceDay()   avança 1 dia (ou lgDebug.advanceDay(3))
//   lgDebug.backDay()      volta 1 dia
//   lgDebug.resetDay()     volta para a data real
//   lgDebug.today()        mostra a data simulada
export function installDebug() {
  window.lgDebug = {
    advanceDay: (n = 1) => shiftDay(dayOffset() + n),
    backDay: (n = 1) => shiftDay(dayOffset() - n),
    resetDay: () => shiftDay(0),
    today: () => dayStr(),
  }
}
