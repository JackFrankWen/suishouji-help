const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * 保存订单数据到CSV文件
 * @param {string} csvContent - CSV内容
 * @param {string} platform - 平台名称 (如 'jd', 'pdd')
 * @returns {string} 文件路径
 */
function saveToCSV(csvContent, platform = 'orders') {
    try {
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 10) + '-' +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0');
        
        // 确保csv目录存在
        const csvDir = path.join(process.cwd(), 'csv');
        if (!fs.existsSync(csvDir)) {
            fs.mkdirSync(csvDir, { recursive: true });
        }
        
        // 存到当前目录/csv目录下
        const filePath = path.join(csvDir, `${platform}-orders-${timestamp}.csv`);
        fs.writeFileSync(filePath, csvContent);
        console.log(chalk.green('✓'), chalk.green(`文件已保存到: ${filePath}`));
        return filePath;
    } catch (error) {
        console.error(chalk.red('✗'), chalk.red('保存订单数据失败:'), error);
    }
}

/**
 * 将数据生成CSV格式
 * @param {Array} data - 数据数组
 * @param {Object} options - 配置选项
 * @param {Array} options.headers - 表头数组
 * @param {Array} options.fields - 要提取的字段名数组
 * @param {Object} options.transforms - 字段转换函数 {字段名: 转换函数}
 * @param {boolean} options.logging - 是否输出日志
 * @returns {string} CSV格式的字符串
 */
function generateCSV(data, options = {}) {
    const {
        headers = ['订单号', '下单时间', '订单总价', '订单状态', '商品名称'],
        fields = ['orderId', 'orderTime', 'totalPrice', 'status', 'name'],
        transforms = {},
        logging = true
    } = options;

    const rows = [headers];

    data.forEach(item => {
        const row = fields.map(field => {
            let value = item[field] || '';
            // 应用转换函数
            if (transforms[field]) {
                value = transforms[field](value);
            }
            return value;
        });
        rows.push(row);
    });

    if (logging) {
        console.log(chalk.blue('ℹ'), chalk.blue(`处理数据: ${data.length} 条`));
    }
    
    return rows.map(row => row.join(',')).join('\n');
}

module.exports = {
    saveToCSV,
    generateCSV
}; 