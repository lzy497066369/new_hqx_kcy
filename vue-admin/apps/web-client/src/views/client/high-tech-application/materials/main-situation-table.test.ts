import { createApp, nextTick, reactive } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import MainSituationTable from './main-situation-table.vue';
import { BOOK_FORM_SECTIONS } from './catalog';

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

describe('main situation table', () => {
  it('keeps every field editable or readonly as configured, with grouped rows and dynamic years', async () => {
    const values = reactive({
      company_name: '测试企业',
      year1_profit: '-1.25',
      rd_basic: '0',
      accident: 'no',
    } as Record<string, string>);
    const props = reactive({
      values,
      year: 2026,
      disabled: false,
      readonlyKeys: ['company_name', 'rd_total_3y'],
    });
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(MainSituationTable, props);
    app.mount(host);
    cleanup = () => {
      app.unmount();
      host.remove();
    };
    const controls = host.querySelectorAll('input, select');
    expect(controls.length).toBe(
      BOOK_FORM_SECTIONS.find((section) => section.key === 'main')!.fields
        .length,
    );
    expect(host.querySelectorAll('tr')).toHaveLength(12);
    expect(host.querySelector('th[rowspan="4"]')?.textContent).toContain(
      '近三年经营情况',
    );
    expect(host.querySelectorAll('[rowspan="2"]')).toHaveLength(3);
    expect(
      host.querySelector<HTMLInputElement>('[aria-label="企业名称"]')!.disabled,
    ).toBe(true);
    expect(
      host.querySelector<HTMLInputElement>(
        '[aria-label="近三年研发费用总额（万元）"]',
      )!.disabled,
    ).toBe(true);
    const profit = host.querySelector<HTMLInputElement>(
      '[aria-label="2023年 利润总额（万元）"]',
    )!;
    expect(profit.value).toBe('-1.25');
    expect(profit.hasAttribute('min')).toBe(false);
    profit.value = '-2.50';
    profit.dispatchEvent(new Event('input', { bubbles: true }));
    const accident = host.querySelector<HTMLSelectElement>('select')!;
    accident.value = 'yes';
    accident.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    expect(values.year1_profit).toBe('-2.50');
    expect(values.accident).toBe('yes');
    expect(
      host.querySelector<HTMLInputElement>(
        '[aria-label="基础研究费用（万元）"]',
      )!.value,
    ).toBe('0');
    values.year1_profit = '12.30';
    await nextTick();
    expect(profit.value).toBe('12.30');
  });

  it('uses the application year and disables all controls while busy', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(MainSituationTable, {
      values: {},
      year: 2028,
      disabled: true,
    });
    app.mount(host);
    cleanup = () => {
      app.unmount();
      host.remove();
    };
    expect(host.textContent).toContain('2025');
    expect(host.textContent).toContain('2027');
    expect(
      host.querySelector('[aria-label="2025年 净资产（万元）"]'),
    ).not.toBeNull();
    expect(
      [...host.querySelectorAll<HTMLInputElement>('input, select')].every(
        (control) => control.disabled,
      ),
    ).toBe(true);
  });
});
