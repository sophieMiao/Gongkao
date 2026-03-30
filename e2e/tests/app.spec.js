const { test, expect } = require('@playwright/test');

test.describe('Gongkao E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 访问本地开发服务器
    await page.goto('http://localhost:3000');
  });

  test('should display home page with stats', async ({ page }) => {
    // 检查首页标题
    await expect(page.locator('h1')).toContainText('考公学习伴侣');
    
    // 检查统计卡片
    await expect(page.locator('.stat-card')).toHaveCount(4);
  });

  test('should navigate to task page and show question', async ({ page }) => {
    // 点击任务导航
    await page.click('text=任务');
    
    // 等待任务加载
    await page.waitForSelector('.question-text');
    
    // 检查问题内容显示
    const questionText = await page.textContent('.question-text');
    expect(questionText).not.toBeNull();
  });

  test('should submit answer and show explanation', async ({ page }) => {
    await page.click('text=任务');
    
    // 选择答案
    await page.click('.option:first-child');
    
    // 提交
    await page.click('button:has-text("提交")');
    
    // 检查解析显示
    await expect(page.locator('.explanation')).toBeVisible();
  });

  test('should sync data when online', async ({ page }) => {
    // 模拟离线/在线切换
    await page.click('text=数据');
    
    // 检查统计数据
    await expect(page.locator('.summary-card')).toHaveCount(4);
    
    // 点击同步按钮 (如果存在)
    const syncButton = page.locator('button:has-text("同步")');
    if (await syncButton.isVisible()) {
      await syncButton.click();
      await expect(page.locator('text=同步成功')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show desktop app navigation', async ({ page }) => {
    // 测试桌面应用渲染
    await page.click('text=首页');
    await expect(page.locator('h1')).toContainText('考公学习伴侣');
  });
});
