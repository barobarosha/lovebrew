/**
 * Низкоуровневый клиент бесплатного Quick Resto Back Office API.
 * Спецификация: openapi-build.json (Quick Resto Back Office API 2.92).
 *
 * - Базовый URL: https://{layer}.quickresto.ru/platform/online
 * - Авторизация: HTTP Basic (логин/пароль пользователя Back Office)
 * - Универсальные CRUD: GET /api/list, POST /api/create|update|remove
 *   с параметрами moduleName и className
 * - Бонусная подсистема: POST /bonuses/filterCustomers|getCustomer|balance|
 *   operationHistory
 */

export class QuickRestoError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "QuickRestoError";
    this.status = status;
  }
}

interface ListFilter {
  field: string;
  operation: "eq" | "neq" | "gte" | "lte" | "gt" | "lt" | "like" | "contains";
  value: string;
}

const REQUEST_TIMEOUT_MS = 9000;

export class BackOfficeClient {
  private readonly baseUrl: string; // https://{layer}.quickresto.ru/platform/online
  private readonly login: string;
  private readonly password: string;

  constructor(baseUrl: string, login: string, password: string) {
    this.baseUrl = baseUrl;
    this.login = login;
    this.password = password;
  }

  private get authHeader(): string {
    return (
      "Basic " + Buffer.from(`${this.login}:${this.password}`).toString("base64")
    );
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
          Connection: "keep-alive",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      throw new QuickRestoError(
        `Сеть/таймаут при обращении к Quick Resto: ${(e as Error).message}`,
      );
    }
    const text = await res.text();
    if (!res.ok) {
      throw new QuickRestoError(
        `Quick Resto ${res.status}: ${text.slice(0, 300)}`,
        res.status,
      );
    }
    try {
      return (text ? JSON.parse(text) : null) as T;
    } catch {
      throw new QuickRestoError(
        `Некорректный JSON от Quick Resto: ${text.slice(0, 200)}`,
      );
    }
  }

  /** GET /api/list?moduleName=...&className=... */
  async list<T = unknown>(
    moduleName: string,
    className: string,
    opts: { filters?: ListFilter[]; limit?: number; offset?: number } = {},
  ): Promise<T> {
    const params = new URLSearchParams({ moduleName, className });
    if (opts.filters?.length) {
      params.set("filters", JSON.stringify(opts.filters));
    }
    const query = `?${params.toString()}`;
    const body =
      opts.limit !== undefined || opts.offset !== undefined
        ? { limit: opts.limit, offset: opts.offset }
        : undefined;
    // У /api/list тело (limit/offset) опционально — без него просто GET
    if (body) {
      return this.request<T>("POST", `/api/list${query}`, body).catch(() =>
        this.request<T>("GET", `/api/list${query}`),
      );
    }
    return this.request<T>("GET", `/api/list${query}`);
  }

  /** POST /api/create?moduleName=...&className=... */
  async create<T = unknown>(
    moduleName: string,
    className: string,
    object: Record<string, unknown>,
  ): Promise<T> {
    const params = new URLSearchParams({ moduleName, className });
    return this.request<T>("POST", `/api/create?${params.toString()}`, object);
  }

  /** POST /bonuses/<operation> */
  async bonuses<T = unknown>(
    operation:
      | "filterCustomers"
      | "getCustomer"
      | "balance"
      | "operationHistory",
    body: Record<string, unknown>,
  ): Promise<T> {
    return this.request<T>("POST", `/bonuses/${operation}`, body);
  }
}

/** Модули/классы Back Office API, которые использует интеграция */
export const QR_MODULES = {
  customer: {
    moduleName: "crm.customer",
    className: "ru.edgex.quickresto.modules.crm.customer.CrmCustomer",
  },
  accountType: {
    moduleName: "crm.accounting.account.type",
    className:
      "ru.edgex.quickresto.modules.crm.accounting.account.type.CustomerAccountType",
  },
  dish: {
    moduleName: "warehouse.nomenclature.dish",
    className:
      "ru.edgex.quickresto.modules.warehouse.nomenclature.dish.Dish",
  },
  dishCategory: {
    moduleName: "warehouse.nomenclature.dish",
    className:
      "ru.edgex.quickresto.modules.warehouse.nomenclature.dish.DishCategory",
  },
} as const;
