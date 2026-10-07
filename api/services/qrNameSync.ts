import { getRestoProvider } from "../quickresto/provider";

/**
 * Синхронизация имени клиента в Quick Resto.
 *
 * Идёт через провайдер (метод updateCustomerName → /bonuses/putCustomer
 * с полным набором полей: customerGuid, version, firstName, contactMethods).
 * Универсальный /api/update crm.customer НЕ используем нигде: он обнуляет
 * непереданные поля — на проде так стёрся телефон живого клиента
 * (contactMethods стало []).
 *
 * Вызывается только в фоне (void ...) — ошибки пишутся в лог и никогда
 * не блокируют смену имени в приложении.
 */

export async function syncCustomerNameToQuickResto(
  phone: string,
  name: string,
): Promise<void> {
  try {
    const provider = await getRestoProvider();
    if (!provider) return;
    await provider.updateCustomerName(phone, name);
  } catch (e) {
    console.error("[quickresto] sync name failed:", (e as Error).message);
  }
}
