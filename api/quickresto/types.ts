/**
 * Нормализованные доменные типы интеграции с Quick Resto.
 *
 * Клиентский интерфейс (tRPC-роутеры, PWA) работает ТОЛЬКО с этими типами
 * и с интерфейсом RestoProvider — он не знает, какой именно API Quick Resto
 * используется под капотом:
 *
 *  - BackOfficeProvider  — бесплатный Back Office API (/api/list, /bonuses/*)
 *  - WLProvider (будущий) — платный WL API (/wlcrm/*): Firebase-авторизация,
 *    полная история заказов, онлайн-заказ и оплата. Добавляется реализацией
 *    этого же интерфейса и выбором в фабрике getRestoProvider() — без
 *    изменений в бизнес-логике и на клиенте.
 */

export interface RestoCustomerRef {
  guid: string;
  firstName?: string;
  phone?: string;
}

export interface RestoBonusBalance {
  accountGuid: string;
  accountName: string;
  balance: number;
}

export interface RestoBonusOperation {
  date: string;
  type: string; // credit / debit / ...
  amount: number;
  comment?: string;
}

export interface RestoMenuItem {
  id: string;
  categoryName: string;
  name: string;
  description?: string;
  price: number | null;
  volume?: string;
  imageUrl?: string;
}

export interface RestoPingResult {
  ok: boolean;
  detail: string;
}

export interface RestoProvider {
  /** Режим интеграции: "backoffice" | "wl" (для отображения в админке) */
  readonly mode: string;

  /** Проверка связи и доступа */
  ping(): Promise<RestoPingResult>;

  /** Найти клиента по номеру телефона (нормализованный, 79XXXXXXXXX) */
  findCustomerByPhone(phone: string): Promise<RestoCustomerRef | null>;

  /** Создать клиента в CRM Quick Resto */
  createCustomer(input: {
    phone: string;
    name: string;
  }): Promise<RestoCustomerRef | null>;

  /** Баланс бонусного счёта по телефону (null — клиент не найден / нет счёта) */
  getBonusBalanceByPhone(phone: string): Promise<RestoBonusBalance | null>;

  /** История операций по бонусному счёту */
  getBonusHistoryByPhone(phone: string): Promise<RestoBonusOperation[]>;

  /** Меню (блюда) из номенклатуры Quick Resto */
  getMenu(): Promise<RestoMenuItem[]>;
}
