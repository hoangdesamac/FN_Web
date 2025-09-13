(async function(){
    const API = window.API_BASE || '/';
    const ordersBody = document.getElementById('ordersBody');
    const filterStatus = document.getElementById('filterStatus');
    const btnReload = document.getElementById('btnReload');
    const adminInfo = document.getElementById('adminInfo');

    function fmtDate(iso){
        try { return new Date(iso).toLocaleString('vi-VN'); } catch { return iso || ''; }
    }

    function statusBadge(st){
        switch(st){
            case 'Đơn hàng đang xử lý': return '<span class="badge-status badge-processing">Xử lý</span>';
            case 'Đơn hàng đang được vận chuyển': return '<span class="badge-status" style="background:#17a2b8">Vận chuyển</span>';
            case 'Đơn hàng đã hoàn thành': return '<span class="badge-status badge-completed">Hoàn thành</span>';
            case 'Đơn hàng đã hủy': return '<span class="badge-status badge-cancelled">Hủy</span>';
            default: return `<span class="badge-status" style="background:#555">${st||'?'}</span>`;
        }
    }

    async function fetchMe() {
        try {
            const r = await fetch(API.replace(/\/$/,'') + '/api/me', {credentials:'include'});
            return await r.json();
        } catch { return {}; }
    }

    async function ensureAdmin() {
        const me = await fetchMe();
        if (!me.loggedIn) {
            ordersBody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Chưa đăng nhập</td></tr>';
            return false;
        }
        adminInfo.textContent = `${me.user?.email || ''}`;
        return true;
    }

    function renderActionCellByStatus(status){
        if (status === 'Đơn hàng đang xử lý') {
            return `
                <button class="action-btn approve me-1" data-action="approve" title="Duyệt"><i class="fa fa-check"></i></button>
                <button class="action-btn cancel" data-action="cancel" title="Hủy"><i class="fa fa-xmark"></i></button>
            `;
        }
        if (status === 'Đơn hàng đang được vận chuyển') {
            return `<span class="text-success fw-semibold">ĐÃ DUYỆT</span>`;
        }
        if (status === 'Đơn hàng đã hủy') {
            return `<span class="text-danger fw-semibold">ĐÃ HỦY</span>`;
        }
        if (status === 'Đơn hàng đã hoàn thành') {
            return `<span class="text-info fw-semibold">HOÀN THÀNH</span>`;
        }
        return '';
    }

    async function loadOrders() {
        ordersBody.innerHTML = '<tr><td colspan="8" class="text-center text-secondary py-3">Đang tải...</td></tr>';
        const qs = filterStatus.value ? '?status=' + encodeURIComponent(filterStatus.value) : '';
        try {
            const r = await fetch(`${API.replace(/\/$/,'')}/api/admin/orders${qs}`, {credentials:'include'});
            const data = await r.json();
            if (!data.success) {
                ordersBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">${data.error || 'Không lấy được dữ liệu'}</td></tr>`;
                return;
            }
            if (!data.orders.length) {
                ordersBody.innerHTML = '<tr><td colspan="8" class="text-center text-warning">Không có đơn nào</td></tr>';
                return;
            }
            ordersBody.innerHTML = data.orders.map(o => {
                const first = o.items && o.items[0];
                const avatar = first?.image || 'https://via.placeholder.com/60x60?text=NO';
                const productsShort = o.items.slice(0,2).map(it => it.name).join(', ') + (o.items.length>2?` +${o.items.length-2}`:'');
                return `
          <tr data-id="${o.id}">
            <td><img src="${avatar}" style="width:46px;height:46px;object-fit:cover;border-radius:6px;border:1px solid #333"></td>
            <td class="small">${o.orderCode}</td>
            <td class="small">${fmtDate(o.createdAt)}</td>
            <td class="small">
                <button class="btn btn-link p-0 text-info btn-sm btn-view-items" data-id="${o.id}" data-code="${o.orderCode}">
                  ${productsShort}
                </button>
            </td>
            <td>${statusBadge(o.status)}</td>
            <td class="small">${o.paymentMethod || '-'}</td>
            <td class="small">${
                    o.rewardClaimed
                        ? `<span class="badge bg-success">${o.rewardPoints}</span>`
                        : (o.status === 'Đơn hàng đã hoàn thành'
                            ? `<span class="text-warning">${o.rewardPoints}</span>`
                            : o.rewardPoints || 0)
                }</td>
            <td class="text-center action-cell">
              ${renderActionCellByStatus(o.status)}
            </td>
          </tr>
        `;
            }).join('');
        } catch (err) {
            console.error(err);
            ordersBody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Lỗi tải dữ liệu</td></tr>';
        }
    }

    function updateRowAfterAction(order, action){
        const row = ordersBody.querySelector(`tr[data-id="${order.id}"]`);
        if (!row) return;
        // Cập nhật trạng thái (cột thứ 5 – index dựa trên cấu trúc hiện tại)
        const tds = row.querySelectorAll('td');
        // Status cell
        if (tds[4]) tds[4].innerHTML = statusBadge(order.status);
        // Reward cell (re-tint nếu cần)
        if (tds[6]) {
            if (order.rewardClaimed) {
                tds[6].innerHTML = `<span class="badge bg-success">${order.rewardPoints}</span>`;
            } else if (order.status === 'Đơn hàng đã hoàn thành') {
                tds[6].innerHTML = `<span class="text-warning">${order.rewardPoints}</span>`;
            } else {
                tds[6].textContent = order.rewardPoints || 0;
            }
        }
        // Action cell
        const actionCell = row.querySelector('.action-cell');
        if (actionCell) {
            if (action === 'approve') {
                actionCell.innerHTML = `<span class="text-success fw-semibold">ĐÃ DUYỆT</span>`;
            } else if (action === 'cancel') {
                actionCell.innerHTML = `<span class="text-danger fw-semibold">ĐÃ HỦY</span>`;
            } else {
                actionCell.innerHTML = '';
            }
        }
    }

    async function updateOrder(id, action) {
        if (!confirm(`Xác nhận thực hiện: ${action==='approve'?'DUYỆT (-> Vận chuyển)':'HỦY'} đơn #${id}?`)) return;
        try {
            const r = await fetch(`${API.replace(/\/$/,'')}/api/admin/orders/${id}/status`, {
                method:'PATCH',
                headers:{'Content-Type':'application/json'},
                credentials:'include',
                body: JSON.stringify({ action })
            });
            const data = await r.json();
            if (!data.success) {
                alert(data.error || 'Cập nhật thất bại');
                return;
            }
            // Cập nhật trực tiếp hàng hiện tại thay vì tải lại toàn bộ
            if (data.order) {
                updateRowAfterAction(data.order, action);
            } else {
                // fallback nếu không có order trong response (không xảy ra theo backend hiện tại)
                await loadOrders();
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi cập nhật');
        }
    }

    function showItemsModal(orderCode, items) {
        const cont = document.getElementById('itemsContainer');
        cont.innerHTML = items.map(it => `
      <div class="product-chip">
        <img src="${it.image}" alt="">
        <div>
          <div>${it.name}</div>
          <div class="text-secondary">${it.quantity} x ${formatCurrency(it.salePrice||0)}</div>
        </div>
      </div>
    `).join('');
        document.getElementById('modalOrderCode').textContent = orderCode;
        const m = new bootstrap.Modal(document.getElementById('modalItems'));
        m.show();
    }

    function formatCurrency(v){
        return (Number(v)||0).toLocaleString('vi-VN') + '₫';
    }

    ordersBody.addEventListener('click', async (e) => {
        const row = e.target.closest('tr[data-id]');
        if (!row) return;
        const id = row.dataset.id;

        const btnAct = e.target.closest('[data-action]');
        if (btnAct) {
            const action = btnAct.getAttribute('data-action');
            updateOrder(id, action);
            return;
        }
        const viewBtn = e.target.closest('.btn-view-items');
        if (viewBtn) {
            try {
                const qs = filterStatus.value ? '?status=' + encodeURIComponent(filterStatus.value) : '';
                const r = await fetch(`${API.replace(/\/$/,'')}/api/admin/orders${qs}`, {credentials:'include'});
                const data = await r.json();
                if (data.success) {
                    const o = data.orders.find(o => String(o.id) === String(id));
                    if (o) showItemsModal(o.orderCode, o.items);
                }
            } catch {}
        }
    });

    btnReload.addEventListener('click', loadOrders);
    filterStatus.addEventListener('change', loadOrders);

    if (await ensureAdmin()) {
        loadOrders();
    }
})();