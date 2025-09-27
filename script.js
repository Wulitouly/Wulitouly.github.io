// 餐厅缺货统计系统 JavaScript

class ShortageTracker {
    constructor() {
        this.shortages = this.loadData();
        this.currentEditingId = null;
        this.lastCheckDate = this.getLastCheckDate();
        this.dateCheckInterval = null;
        this.init();
    }

    // 初始化
    init() {
        this.bindEvents();
        this.checkDateChange();
        this.startDateMonitoring();
        this.updateDisplay();
    }

    // 绑定事件
    bindEvents() {
        // 表单提交
        document.getElementById('shortageForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitShortage();
        });

        // 表单重置时清空编辑状态
        document.getElementById('shortageForm').addEventListener('reset', () => {
            this.cancelEdit();
        });

        // 导出按钮
        document.getElementById('exportExcel').addEventListener('click', () => {
            this.exportToExcel();
        });

        document.getElementById('exportSummary').addEventListener('click', () => {
            this.exportSummary();
        });

        document.getElementById('historyData').addEventListener('click', () => {
            this.showHistoryModal();
        });

        // 添加手动检查日期变化的快捷键（Ctrl+Shift+D）
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.manualDateCheck();
            }
            // 添加强制重置快捷键（Ctrl+Shift+R）
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                this.forceResetDate();
            }
            // 添加手动刷新快捷键（Ctrl+Shift+F）
            if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                this.manualRefresh();
            }
            // 添加调试快捷键（Ctrl+Shift+G）
            if (e.ctrlKey && e.shiftKey && e.key === 'G') {
                e.preventDefault();
                this.debugData();
            }
            // 添加数据迁移快捷键（Ctrl+Shift+M）
            if (e.ctrlKey && e.shiftKey && e.key === 'M') {
                e.preventDefault();
                this.migrateDataDates();
            }
            // 添加强制清理快捷键（Ctrl+Shift+C）
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                this.forceCleanYesterdayData();
            }
        });

        // 弹窗事件
        document.getElementById('editBtn').addEventListener('click', () => {
            this.editShortage();
        });

        document.getElementById('deleteBtn').addEventListener('click', () => {
            this.deleteShortage();
        });

        document.getElementById('markRestockedBtn').addEventListener('click', () => {
            this.markAsRestocked();
        });

        // 关闭弹窗
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('actionModal').addEventListener('click', (e) => {
            if (e.target.id === 'actionModal') {
                this.closeModal();
            }
        });

        // 历史数据弹窗事件
        document.getElementById('historyDateSelect').addEventListener('change', (e) => {
            this.loadHistoryData(e.target.value);
        });

        document.getElementById('exportHistoryBtn').addEventListener('click', () => {
            this.exportHistoryData();
        });

        document.getElementById('historyModal').addEventListener('click', (e) => {
            if (e.target.id === 'historyModal') {
                this.closeHistoryModal();
            }
        });

        // 历史数据弹窗关闭按钮
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                if (e.target.closest('#historyModal')) {
                    this.closeHistoryModal();
                } else {
                    this.closeModal();
                }
            });
        });
    }

    // 提交缺货信息
    submitShortage() {
        const form = document.getElementById('shortageForm');
        const formData = new FormData(form);
        
        const existingRecord = this.currentEditingId ? 
            this.shortages.find(s => s.id === this.currentEditingId) : null;
            
        // 使用洛杉矶时区计算日期
        const now = new Date();
        const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const laDateStr = laTime.toISOString().split('T')[0];
        const laTimestamp = laTime.toLocaleString('zh-CN');
        
        const shortage = {
            id: this.currentEditingId || Date.now(),
            productName: formData.get('productName'),
            category: formData.get('category'),
            shortageLevel: formData.get('shortageLevel'),
            reporter: formData.get('reporter'),
            notes: formData.get('notes'),
            timestamp: existingRecord ? existingRecord.timestamp : laTimestamp,
            date: existingRecord ? existingRecord.date : laDateStr
        };

        // 验证必填字段
        if (!shortage.productName || !shortage.category || !shortage.shortageLevel || !shortage.reporter) {
            alert('请填写所有必填字段！');
            return;
        }

        if (this.currentEditingId) {
            // 编辑模式：更新现有记录
            const index = this.shortages.findIndex(s => s.id === this.currentEditingId);
            if (index !== -1) {
                this.shortages[index] = shortage;
                this.showMessage('缺货信息修改成功！', 'success');
            } else {
                this.showMessage('修改失败：找不到原记录', 'error');
                return;
            }
        } else {
            // 新增模式：添加新记录
            this.shortages.push(shortage);
            this.showMessage('缺货信息提交成功！', 'success');
        }

        this.saveData();
        this.updateDisplay();
        form.reset();
        
        // 重置按钮状态
        const submitBtn = document.querySelector('.submit-btn');
        submitBtn.textContent = '📤 提交缺货信息';
        submitBtn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
        
        this.currentEditingId = null;
    }

    // 更新显示
    updateDisplay() {
        this.updateStats();
        this.updateRecentList();
    }

    // 更新统计数据
    updateStats() {
        // 使用洛杉矶时区计算今日
        const now = new Date();
        const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const todayStr = laTime.toISOString().split('T')[0];
        
        const todayShortages = this.shortages.filter(s => s.date === todayStr);
        
        const totalShortages = todayShortages.length;
        const urgentShortages = todayShortages.filter(s => 
            s.shortageLevel === '严重' || s.shortageLevel === '完全缺货'
        ).length;
        
        // 待补货：累积统计所有未完成的缺货记录
        const pendingRestock = this.getPendingRestockCount();

        document.getElementById('totalShortages').textContent = totalShortages;
        document.getElementById('urgentShortages').textContent = urgentShortages;
        document.getElementById('pendingRestock').textContent = pendingRestock;
        
        console.log('今日统计更新:', {
            今日日期: todayStr,
            总缺货项: totalShortages,
            紧急缺货: urgentShortages,
            待补货: pendingRestock
        });
    }

    // 更新当日上报列表
    updateRecentList() {
        const recentList = document.getElementById('recentList');
        
        // 使用洛杉矶时区计算今日
        const now = new Date();
        const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const todayStr = laTime.toISOString().split('T')[0];
        
        // 只显示今日的记录，按时间倒序排列
        const todayShortages = this.shortages
            .filter(s => {
                const isToday = s.date === todayStr;
                console.log(`记录 ${s.productName}: 日期=${s.date}, 今日=${todayStr}, 匹配=${isToday}`);
                return isToday;
            })
            .sort((a, b) => b.id - a.id);

        if (todayShortages.length === 0) {
            recentList.innerHTML = '<p class="no-data">今日暂无缺货记录</p>';
            return;
        }

        recentList.innerHTML = todayShortages.map(shortage => `
            <div class="shortage-item ${this.getUrgencyClass(shortage.shortageLevel)} ${shortage.isRestocked ? 'restocked' : ''}" data-id="${shortage.id}" style="cursor: pointer;">
                <div class="shortage-header">
                    <span class="product-name">${shortage.productName}</span>
                    <span class="shortage-level ${shortage.shortageLevel}">${this.getShortageLevelText(shortage.shortageLevel)}</span>
                </div>
                <div class="shortage-details">
                    <div><strong>类别:</strong> ${shortage.category}</div>
                    <div><strong>上报人:</strong> ${shortage.reporter}</div>
                    <div><strong>时间:</strong> ${shortage.timestamp}</div>
                    ${shortage.notes ? `<div><strong>备注:</strong> ${shortage.notes}</div>` : ''}
                    ${shortage.isRestocked ? `<div><strong>状态:</strong> <span style="color: #27ae60;">✅ 已补货</span></div>` : ''}
                </div>
            </div>
        `).join('');

        // 为每个缺货记录添加点击事件
        recentList.querySelectorAll('.shortage-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const id = parseInt(item.dataset.id);
                this.showActionModal(id);
            });
        });
        
        console.log('当日上报更新:', {
            今日日期: todayStr,
            记录数量: todayShortages.length
        });
    }

    // 获取待补货数量（累积统计）
    getPendingRestockCount() {
        // 获取所有未标记为已补货的记录
        const pendingShortages = this.shortages.filter(s => !s.isRestocked);
        return pendingShortages.length;
    }

    // 获取紧急程度样式类
    getUrgencyClass(level) {
        if (level === '严重' || level === '完全缺货') return 'urgent';
        return '';
    }

    // 获取缺货程度文本
    getShortageLevelText(level) {
        const levelMap = {
            '轻微': '🟡 轻微',
            '严重': '🔵 严重',
            '完全缺货': '🔴 完全缺货'
        };
        return levelMap[level] || level;
    }

    // 导出Excel报表
    exportToExcel() {
        const today = new Date().toISOString().split('T')[0];
        const todayShortages = this.shortages.filter(s => s.date === today);
        
        if (todayShortages.length === 0) {
            alert('今日暂无缺货数据可导出！');
            return;
        }

        // 创建CSV内容
        const headers = ['产品名称', '类别', '缺货程度', '上报人', '备注', '上报时间'];
        const csvContent = [
            headers.join(','),
            ...todayShortages.map(s => [
                s.productName,
                s.category,
                s.shortageLevel,
                s.reporter,
                s.notes || '',
                s.timestamp
            ].map(field => `"${field}"`).join(','))
        ].join('\n');

        this.downloadFile(csvContent, `缺货统计_${today}.csv`, 'text/csv');
        this.showMessage('Excel报表导出成功！', 'success');
    }

    // 导出汇总报告
    exportSummary() {
        const today = new Date().toISOString().split('T')[0];
        const todayShortages = this.shortages.filter(s => s.date === today);
        
        if (todayShortages.length === 0) {
            alert('今日暂无缺货数据可导出！');
            return;
        }

        // 按类别统计
        const categoryStats = {};
        const levelStats = {};
        
        todayShortages.forEach(s => {
            categoryStats[s.category] = (categoryStats[s.category] || 0) + 1;
            levelStats[s.shortageLevel] = (levelStats[s.shortageLevel] || 0) + 1;
        });

        // 生成汇总报告
        let report = `餐厅缺货统计汇总报告\n`;
        report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
        report += `统计日期: ${today}\n\n`;
        
        report += `=== 总体统计 ===\n`;
        report += `总缺货项数: ${todayShortages.length}\n`;
        report += `涉及类别数: ${Object.keys(categoryStats).length}\n\n`;
        
        report += `=== 按类别统计 ===\n`;
        Object.entries(categoryStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, count]) => {
                report += `${category}: ${count}项\n`;
            });
        
        report += `\n=== 按缺货程度统计 ===\n`;
        Object.entries(levelStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([level, count]) => {
                report += `${level}: ${count}项\n`;
            });
        
        report += `\n=== 详细缺货清单 ===\n`;
        todayShortages.forEach((s, index) => {
            report += `${index + 1}. ${s.productName} (${s.category}) - ${s.shortageLevel}\n`;
            report += `   上报人: ${s.reporter} | 时间: ${s.timestamp}\n`;
            if (s.notes) report += `   备注: ${s.notes}\n`;
            report += `\n`;
        });

        this.downloadFile(report, `缺货汇总报告_${today}.txt`, 'text/plain');
        this.showMessage('汇总报告导出成功！', 'success');
    }

    // 清空数据
    clearData() {
        if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
            this.shortages = [];
            this.saveData();
            this.updateDisplay();
            this.showMessage('数据已清空！', 'warning');
        }
    }

    // 下载文件
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // 显示消息
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;

        // 设置背景颜色
        const colors = {
            success: '#27ae60',
            warning: '#f39c12',
            error: '#e74c3c',
            info: '#3498db'
        };
        messageEl.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(messageEl);

        // 3秒后自动移除
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    // 保存数据到本地存储
    saveData() {
        localStorage.setItem('restaurantShortages', JSON.stringify(this.shortages));
    }

    // 从本地存储加载数据
    loadData() {
        const data = localStorage.getItem('restaurantShortages');
        return data ? JSON.parse(data) : [];
    }

    // 显示操作弹窗
    showActionModal(id) {
        this.currentEditingId = id;
        document.getElementById('actionModal').style.display = 'block';
    }

    // 关闭弹窗
    closeModal() {
        document.getElementById('actionModal').style.display = 'none';
        // 注意：不在这里清空 currentEditingId，因为编辑模式下需要保持
    }

    // 编辑缺货记录
    editShortage() {
        if (!this.currentEditingId) return;
        
        const shortage = this.shortages.find(s => s.id === this.currentEditingId);
        if (!shortage) return;

        // 填充表单
        document.getElementById('productName').value = shortage.productName;
        document.getElementById('category').value = shortage.category;
        document.getElementById('shortageLevel').value = shortage.shortageLevel;
        document.getElementById('reporter').value = shortage.reporter;
        document.getElementById('notes').value = shortage.notes || '';

        // 更新提交按钮文本
        const submitBtn = document.querySelector('.submit-btn');
        submitBtn.textContent = '✏️ 修改缺货信息';
        submitBtn.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';

        // 滚动到表单
        document.querySelector('.input-section').scrollIntoView({ behavior: 'smooth' });
        
        this.closeModal();
        this.showMessage('请修改表单中的信息，然后点击修改按钮', 'info');
    }

    // 删除缺货记录
    deleteShortage() {
        if (!this.currentEditingId) return;
        
        if (confirm('确定要删除这条缺货记录吗？')) {
            this.shortages = this.shortages.filter(s => s.id !== this.currentEditingId);
            this.saveData();
            this.updateDisplay();
            this.closeModal();
            this.showMessage('缺货记录已删除！', 'warning');
        }
    }

    // 标记为已补货
    markAsRestocked() {
        if (!this.currentEditingId) return;
        
        const shortage = this.shortages.find(s => s.id === this.currentEditingId);
        if (!shortage) return;

        if (shortage.isRestocked) {
            this.showMessage('该记录已经标记为已补货！', 'info');
            return;
        }

        if (confirm('确定要将此商品标记为已补货吗？')) {
            shortage.isRestocked = true;
            shortage.restockedTime = new Date().toLocaleString('zh-CN');
            this.saveData();
            this.updateDisplay();
            this.closeModal();
            this.showMessage('已标记为已补货！', 'success');
        }
    }

    // 取消编辑
    cancelEdit() {
        this.currentEditingId = null;
        const submitBtn = document.querySelector('.submit-btn');
        submitBtn.textContent = '📤 提交缺货信息';
        submitBtn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
    }

    // 获取上次检查日期
    getLastCheckDate() {
        const lastCheck = localStorage.getItem('lastCheckDate');
        if (lastCheck) {
            return new Date(lastCheck);
        } else {
            // 如果没有记录，设置为当前洛杉矶时间
            const now = new Date();
            const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
            return laTime;
        }
    }

    // 检查日期变化
    checkDateChange() {
        // 使用洛杉矶时区
        const now = new Date();
        const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const todayStr = laTime.toISOString().split('T')[0];
        const lastCheckStr = this.lastCheckDate.toISOString().split('T')[0];
        
        console.log('=== 日期检查 ===');
        console.log('当前洛杉矶日期:', todayStr);
        console.log('上次检查日期:', lastCheckStr);
        console.log('洛杉矶时间:', laTime.toLocaleString());
        
        if (todayStr !== lastCheckStr) {
            console.log('检测到日期变化，执行自动清零...');
            // 日期已变化，保存历史数据并清空当日显示
            this.saveHistoryData();
            this.clearTodayDisplay();
            this.lastCheckDate = now;
            localStorage.setItem('lastCheckDate', now.toISOString());
            this.showMessage('新的一天开始了！昨日数据已保存到历史记录中。', 'info');
        } else {
            console.log('日期未变化，无需执行清零');
        }
    }

    // 保存历史数据
    saveHistoryData() {
        // 使用洛杉矶时区计算昨天
        const now = new Date();
        const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const yesterday = new Date(laTime);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        console.log('保存历史数据，日期:', yesterdayStr);
        
        const yesterdayShortages = this.shortages.filter(s => s.date === yesterdayStr);
        if (yesterdayShortages.length > 0) {
            const historyData = JSON.parse(localStorage.getItem('shortageHistory') || '[]');
            historyData.push({
                date: yesterdayStr,
                shortages: yesterdayShortages,
                totalCount: yesterdayShortages.length,
                urgentCount: yesterdayShortages.filter(s => 
                    s.shortageLevel === '严重' || s.shortageLevel === '完全缺货'
                ).length
            });
            localStorage.setItem('shortageHistory', JSON.stringify(historyData));
            console.log('已保存', yesterdayShortages.length, '条历史记录');
        }
    }

    // 开始日期监控
    startDateMonitoring() {
        // 每分钟检查一次日期变化
        this.dateCheckInterval = setInterval(() => {
            this.checkDateChange();
        }, 60000); // 60秒检查一次
    }

    // 停止日期监控
    stopDateMonitoring() {
        if (this.dateCheckInterval) {
            clearInterval(this.dateCheckInterval);
            this.dateCheckInterval = null;
        }
    }

    // 手动检查日期变化
    manualDateCheck() {
        console.log('手动触发日期检查...');
        this.checkDateChange();
        this.showMessage('已手动检查日期变化', 'info');
    }

    // 强制重置日期检查
    forceResetDate() {
        if (confirm('确定要强制重置日期检查吗？这将触发自动清零功能。')) {
            // 清除上次检查日期记录
            localStorage.removeItem('lastCheckDate');
            // 重新初始化
            this.lastCheckDate = this.getLastCheckDate();
            // 立即检查日期变化
            this.checkDateChange();
            this.showMessage('已强制重置日期检查', 'warning');
        }
    }

    // 手动刷新显示
    manualRefresh() {
        console.log('手动刷新显示...');
        this.updateDisplay();
        this.showMessage('显示已刷新', 'info');
    }

    // 调试数据
    debugData() {
        const now = new Date();
        const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const todayStr = laTime.toISOString().split('T')[0];
        
        console.log('=== 调试信息 ===');
        console.log('当前洛杉矶时间:', laTime.toLocaleString());
        console.log('今日日期:', todayStr);
        console.log('所有记录:', this.shortages);
        console.log('今日记录:', this.shortages.filter(s => s.date === todayStr));
        console.log('昨日记录:', this.shortages.filter(s => s.date !== todayStr));
        
        this.showMessage('调试信息已输出到控制台', 'info');
    }

    // 迁移数据日期
    migrateDataDates() {
        if (confirm('确定要迁移数据日期到洛杉矶时区吗？这将更新所有记录的日期字段。')) {
            let updated = 0;
            this.shortages.forEach(shortage => {
                // 根据时间戳重新计算洛杉矶时区的日期
                const timestamp = new Date(shortage.timestamp);
                const laTime = new Date(timestamp.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
                const newDate = laTime.toISOString().split('T')[0];
                
                if (shortage.date !== newDate) {
                    shortage.date = newDate;
                    updated++;
                }
            });
            
            if (updated > 0) {
                this.saveData();
                this.updateDisplay();
                this.showMessage(`已更新 ${updated} 条记录的日期`, 'success');
            } else {
                this.showMessage('所有记录的日期都是正确的', 'info');
            }
        }
    }

    // 强制清理昨日数据
    forceCleanYesterdayData() {
        const now = new Date();
        const laTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const todayStr = laTime.toISOString().split('T')[0];
        
        const yesterdayShortages = this.shortages.filter(s => s.date !== todayStr);
        
        if (yesterdayShortages.length > 0) {
            if (confirm(`发现 ${yesterdayShortages.length} 条昨日记录，确定要清理吗？`)) {
                // 先保存到历史记录
                this.saveHistoryData();
                
                // 清理昨日数据
                this.shortages = this.shortages.filter(s => s.date === todayStr);
                this.saveData();
                this.updateDisplay();
                
                this.showMessage(`已清理 ${yesterdayShortages.length} 条昨日记录`, 'success');
            }
        } else {
            this.showMessage('没有发现昨日记录', 'info');
        }
    }

    // 清空当日显示
    clearTodayDisplay() {
        // 不再清空当日显示，因为待补货和当日上报需要保留
        // 只清空当日的统计数据，但保留所有记录
        this.showMessage('新的一天开始了！昨日数据已保存到历史记录中。', 'info');
    }

    // 显示历史数据弹窗
    showHistoryModal() {
        this.loadHistoryDateOptions();
        document.getElementById('historyModal').style.display = 'block';
    }

    // 关闭历史数据弹窗
    closeHistoryModal() {
        document.getElementById('historyModal').style.display = 'none';
    }

    // 加载历史日期选项
    loadHistoryDateOptions() {
        const historyData = JSON.parse(localStorage.getItem('shortageHistory') || '[]');
        const select = document.getElementById('historyDateSelect');
        
        select.innerHTML = '<option value="">选择日期查看</option>';
        
        historyData.forEach(day => {
            const option = document.createElement('option');
            option.value = day.date;
            option.textContent = `${day.date} (${day.totalCount}条记录)`;
            select.appendChild(option);
        });
    }

    // 加载历史数据
    loadHistoryData(date) {
        if (!date) {
            document.getElementById('historyContent').innerHTML = '<p class="no-data">请选择日期查看历史记录</p>';
            return;
        }

        const historyData = JSON.parse(localStorage.getItem('shortageHistory') || '[]');
        const dayData = historyData.find(d => d.date === date);
        
        if (!dayData) {
            document.getElementById('historyContent').innerHTML = '<p class="no-data">该日期没有历史记录</p>';
            return;
        }

        const content = document.getElementById('historyContent');
        content.innerHTML = `
            <div class="history-date-header">
                ${date} - 共 ${dayData.totalCount} 条记录，其中 ${dayData.urgentCount} 条紧急缺货
            </div>
            ${dayData.shortages.map(shortage => `
                <div class="history-item ${this.getUrgencyClass(shortage.shortageLevel)}">
                    <div class="history-item-header">
                        <span class="history-product-name">${shortage.productName}</span>
                        <span class="history-shortage-level ${shortage.shortageLevel}">${this.getShortageLevelText(shortage.shortageLevel)}</span>
                    </div>
                    <div class="history-details">
                        <div><strong>类别:</strong> ${shortage.category}</div>
                        <div><strong>上报人:</strong> ${shortage.reporter}</div>
                        <div><strong>时间:</strong> ${shortage.timestamp}</div>
                        ${shortage.notes ? `<div><strong>备注:</strong> ${shortage.notes}</div>` : ''}
                    </div>
                </div>
            `).join('')}
        `;
    }

    // 导出历史数据
    exportHistoryData() {
        const selectedDate = document.getElementById('historyDateSelect').value;
        if (!selectedDate) {
            alert('请先选择要导出的日期！');
            return;
        }

        const historyData = JSON.parse(localStorage.getItem('shortageHistory') || '[]');
        const dayData = historyData.find(d => d.date === selectedDate);
        
        if (!dayData) {
            alert('该日期没有历史记录！');
            return;
        }

        // 创建CSV内容
        const headers = ['产品名称', '类别', '缺货程度', '上报人', '备注', '上报时间'];
        const csvContent = [
            headers.join(','),
            ...dayData.shortages.map(s => [
                s.productName,
                s.category,
                s.shortageLevel,
                s.reporter,
                s.notes || '',
                s.timestamp
            ].map(field => `"${field}"`).join(','))
        ].join('\n');

        this.downloadFile(csvContent, `历史缺货记录_${selectedDate}.csv`, 'text/csv');
        this.showMessage('历史数据导出成功！', 'success');
    }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new ShortageTracker();
});
