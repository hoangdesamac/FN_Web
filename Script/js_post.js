// Khởi tạo dữ liệu từ localStorage hoặc mảng mặc định
let posts = JSON.parse(localStorage.getItem('posts')) || [
    {
        id: '1',
        title: "Bán tai nghe Bluetooth Sony WH-1000XM4",
        description: "Tai nghe mới 95%, chất lượng âm thanh tuyệt vời.",
        price: 5000000,
        category: "Tai nghe",
        comments: [],
        image: null
    },
    {
        id: '2',
        title: "Bàn phím cơ Keychron K2",
        description: "Bàn phím cơ RGB, switch Gateron Red, còn bảo hành 6 tháng.",
        price: 2000000,
        category: "Bàn phím",
        comments: [],
        image: null
    }
];

let currentPage = 1;
const postsPerPage = 5;

// Lưu dữ liệu vào localStorage
function savePosts() {
    localStorage.setItem('posts', JSON.stringify(posts));
}

// Tạo ID duy nhất
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Hiển thị danh sách bài đăng với phân trang
function displayPosts(filteredPosts) {
    const postList = document.getElementById('postList');
    postList.innerHTML = '';

    const start = (currentPage - 1) * postsPerPage;
    const end = start + postsPerPage;
    const paginatedPosts = filteredPosts.slice(start, end);

    paginatedPosts.forEach(post => {
        const postDiv = document.createElement('div');
        postDiv.className = 'post card mb-3';
        postDiv.innerHTML = `
      <div class="card-body">
        <h3 class="card-title">${post.title}</h3>
        ${post.image ? `<img src="${post.image}" class="img-fluid mb-2" alt="Hình ảnh sản phẩm">` : ''}
        <p class="card-text">${post.description}</p>
        <p class="card-text text-primary fw-bold">${post.price.toLocaleString()} VND</p>
        <p class="card-text text-muted">${post.comments.length} bình luận</p>
        <button class="btn btn-primary btn-sm me-2" id="commentButton-${post.id}">Bình luận</button>
        <button class="btn btn-outline-secondary btn-sm me-2" id="editButton-${post.id}">Chỉnh sửa</button>
        <button class="btn btn-outline-danger btn-sm" id="deleteButton-${post.id}">Xóa</button>
        <div class="comment-form mt-2" id="commentForm-${post.id}" style="display: none;">
          <div class="input-group">
            <input type="text" class="form-control" id="commentInput-${post.id}" placeholder="Nhập bình luận...">
            <button class="btn btn-warning" id="submitCommentButton-${post.id}">Gửi</button>
          </div>
        </div>
        <div class="comment-list mt-2">
          ${post.comments.map((comment, index) => `
            <div class="comment d-flex justify-content-between">
              <span>${comment}</span>
              <div>
                <button class="btn btn-outline-secondary btn-sm me-1" id="editCommentButton-${post.id}-${index}">Chỉnh sửa</button>
                <button class="btn btn-outline-danger btn-sm" id="deleteCommentButton-${post.id}-${index}">Xóa</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
        postList.appendChild(postDiv);
    });

    updatePagination(filteredPosts);
}

// Cập nhật phân trang
function updatePagination(filteredPosts) {
    const pagination = document.getElementById('pagination');
    const pageCount = Math.ceil(filteredPosts.length / postsPerPage);
    pagination.innerHTML = '';

    pagination.innerHTML += `
    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Previous</a>
    </li>
  `;

    for (let i = 1; i <= pageCount; i++) {
        pagination.innerHTML += `
      <li class="page-item ${i === currentPage ? 'active' : ''}">
        <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
      </li>
    `;
    }

    pagination.innerHTML += `
    <li class="page-item ${currentPage === pageCount ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Next</a>
    </li>
  `;
}

// Thay đổi trang
function changePage(page) {
    currentPage = page;
    displayPosts(posts);
}

// Hiển thị/ẩn form bình luận
function toggleCommentForm(postId) {
    const commentForm = document.getElementById(`commentForm-${postId}`);
    commentForm.style.display = commentForm.style.display === 'block' ? 'none' : 'block';
}

// Gửi bình luận
function submitComment(postId) {
    const commentInput = document.getElementById(`commentInput-${postId}`);
    const commentText = commentInput.value.trim();
    if (commentText) {
        const post = posts.find(p => p.id === postId);
        post.comments.push(commentText);
        savePosts();
        displayPosts(posts);
        commentInput.value = '';
    } else {
        alert('Vui lòng nhập bình luận!');
    }
}

// Hiển thị form đăng bài/chỉnh sửa
function showPostForm(mode, postId = null) {
    const modal = new bootstrap.Modal(document.getElementById('postFormModal'));
    const title = document.getElementById('postFormLabel');
    const editPostId = document.getElementById('editPostId');
    const postTitle = document.getElementById('postTitle');
    const postDescription = document.getElementById('postDescription');
    const postPrice = document.getElementById('postPrice');
    const postCategory = document.getElementById('postCategory');
    const postImage = document.getElementById('postImage');
    const previewImage = document.getElementById('previewImage');

    if (mode === 'edit' && postId) {
        title.textContent = 'Chỉnh sửa bài đăng';
        editPostId.value = postId;
        const post = posts.find(p => p.id === postId);
        postTitle.value = post.title;
        postDescription.value = post.description;
        postPrice.value = post.price;
        postCategory.value = post.category;
        if (post.image) {
            previewImage.src = post.image;
            previewImage.style.display = 'block';
        } else {
            previewImage.style.display = 'none';
        }
    } else {
        title.textContent = 'Đăng bài mới';
        editPostId.value = '';
        postTitle.value = '';
        postDescription.value = '';
        postPrice.value = '';
        postCategory.value = 'Tai nghe';
        postImage.value = '';
        previewImage.style.display = 'none';
    }
    modal.show();
}

// Đóng form đăng bài
function closePostForm() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('postFormModal'));
    modal.hide();
}

// Hiển thị form chỉnh sửa bình luận
function editComment(postId, commentIndex) {
    const modal = new bootstrap.Modal(document.getElementById('commentFormModal'));
    const editCommentPostId = document.getElementById('editCommentPostId');
    const editCommentIndex = document.getElementById('editCommentIndex');
    const editCommentText = document.getElementById('editCommentText');
    const post = posts.find(p => p.id === postId);
    editCommentPostId.value = postId;
    editCommentIndex.value = commentIndex;
    editCommentText.value = post.comments[commentIndex];
    modal.show();
}

// Đóng form chỉnh sửa bình luận
function closeCommentForm() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('commentFormModal'));
    modal.hide();
}

// Lưu chỉnh sửa bình luận
function submitCommentEdit() {
    const postId = document.getElementById('editCommentPostId').value;
    const commentIndex = parseInt(document.getElementById('editCommentIndex').value);
    const commentText = document.getElementById('editCommentText').value.trim();
    if (commentText) {
        const post = posts.find(p => p.id === postId);
        post.comments[commentIndex] = commentText;
        savePosts();
        displayPosts(posts);
        closeCommentForm();
    } else {
        alert('Vui lòng nhập nội dung bình luận!');
    }
}

// Xóa bình luận
function deleteComment(postId, commentIndex) {
    if (confirm('Bạn có chắc muốn xóa bình luận này?')) {
        const post = posts.find(p => p.id === postId);
        post.comments.splice(commentIndex, 1);
        savePosts();
        displayPosts(posts);
    }
}

// Xử lý nén ảnh
document.getElementById('postImage').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        new Compressor(file, {
            quality: 0.7,
            maxWidth: 600,
            maxHeight: 600,
            success(result) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const previewImage = document.getElementById('previewImage');
                    previewImage.src = e.target.result;
                    previewImage.style.display = 'block';
                };
                reader.readAsDataURL(result);
            },
            error(err) {
                console.error('Nén ảnh thất bại:', err);
                alert('Không thể nén ảnh, vui lòng thử lại.');
            }
        });
    }
});

// Gửi bài đăng
function submitPost() {
    const editPostId = document.getElementById('editPostId').value;
    const title = document.getElementById('postTitle').value;
    const description = document.getElementById('postDescription').value;
    const price = parseInt(document.getElementById('postPrice').value);
    const category = document.getElementById('postCategory').value;
    const previewImage = document.getElementById('previewImage');

    if (title && description && price && category) {
        const postData = {
            id: editPostId || generateId(),
            title,
            description,
            price,
            category,
            comments: editPostId ? posts.find(p => p.id === editPostId).comments : [],
            image: previewImage.style.display === 'block' ? previewImage.src : null
        };

        if (editPostId) {
            const index = posts.findIndex(p => p.id === editPostId);
            posts[index] = postData;
        } else {
            posts.push(postData);
        }

        savePosts();
        displayPosts(posts);
        closePostForm();
    } else {
        alert('Vui lòng điền đầy đủ thông tin!');
    }
}

// Chỉnh sửa bài đăng
function editPost(postId) {
    showPostForm('edit', postId);
}

// Xóa bài đăng
function deletePost(postId) {
    if (confirm('Bạn có chắc muốn xóa bài đăng này?')) {
        posts = posts.filter(p => p.id !== postId);
        savePosts();
        displayPosts(posts);
    }
}

// Lọc bài đăng
function filterPosts(category) {
    currentPage = 1;
    if (category === 'all') {
        displayPosts(posts);
    } else {
        const filteredPosts = posts.filter(post => post.category === category);
        displayPosts(filteredPosts);
    }
}

// Tìm kiếm bài đăng
document.getElementById('searchInput').addEventListener('input', function(e) {
    currentPage = 1;
    const searchTerm = e.target.value.toLowerCase();
    const filteredPosts = posts.filter(post =>
        post.title.toLowerCase().includes(searchTerm) ||
        post.description.toLowerCase().includes(searchTerm)
    );
    displayPosts(filteredPosts);
});

// Gắn sự kiện sau khi DOM tải xong
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('postButton').addEventListener('click', function() { showPostForm('new'); });

    // Gắn sự kiện cho danh mục
    ['all', 'Tai nghe', 'Bàn phím', 'Chuột', 'Khác'].forEach(category => {
        document.getElementById(`category-${category}`).addEventListener('click', function() {
            filterPosts(category);
        });
    });

    // Gắn sự kiện cho bài đăng
    posts.forEach(post => {
        document.getElementById(`commentButton-${post.id}`).addEventListener('click', function() { toggleCommentForm(post.id); });
        document.getElementById(`editButton-${post.id}`).addEventListener('click', function() { editPost(post.id); });
        document.getElementById(`deleteButton-${post.id}`).addEventListener('click', function() { deletePost(post.id); });
        document.getElementById(`submitCommentButton-${post.id}`).addEventListener('click', function() { submitComment(post.id); });

        post.comments.forEach((_, index) => {
            document.getElementById(`editCommentButton-${post.id}-${index}`).addEventListener('click', function() { editComment(post.id, index); });
            document.getElementById(`deleteCommentButton-${post.id}-${index}`).addEventListener('click', function() { deleteComment(post.id, index); });
        });
    });

    // Hiển thị bài đăng ban đầu
    displayPosts(posts);
});