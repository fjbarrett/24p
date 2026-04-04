declare module "pg" {
  export type QueryResultRow = Record<string, unknown>;

  export type QueryResult<R extends QueryResultRow = QueryResultRow> = {
    rows: R[];
    rowCount: number;
  };

  export class Pool {
    constructor(config?: Record<string, unknown>);
    query<R extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<R>>;
  }
}
