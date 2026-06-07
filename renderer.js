document.addEventListener('DOMContentLoaded', () => {
  let attachments = [];
  let requirements = [];
  
  const attachmentsListEl = document.getElementById('attachments-list');
  const requirementsListEl = document.getElementById('requirements-list');
  const addAttachmentBtn = document.getElementById('add-attachment-btn');
  const addReqBtn = document.getElementById('add-req-btn');
  const saveBtn = document.getElementById('save-btn');
  const statusMessageEl = document.getElementById('status-message');

  // Settings Logic
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const mappingFilePathInput = document.getElementById('mapping-file-path');

  settingsBtn.addEventListener('click', () => {
    mappingFilePathInput.value = localStorage.getItem('mappingFilePath') || '';
    settingsModal.style.display = 'flex';
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  saveSettingsBtn.addEventListener('click', () => {
    localStorage.setItem('mappingFilePath', mappingFilePathInput.value.trim());
    settingsModal.style.display = 'none';
    showStatus('환경설정이 저장되었습니다.');
  });

  mappingFilePathInput.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const response = await window.api.selectMappingFile();
      if (response && response.success) {
        mappingFilePathInput.value = response.filePath;
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Add initial requirement based on example
  addRequirement('', '');

  // Add Attachment Logic
  addAttachmentBtn.addEventListener('click', async () => {
    try {
      const response = await window.api.selectAndCopyAttachment();
      if (response && response.success) {
        addAttachment(response.filePath, '');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Save Path click logic
  const filePathInput = document.getElementById('file-path');
  filePathInput.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const response = await window.api.selectSavePath();
      if (response && response.success) {
        filePathInput.value = response.filePath;
      }
    } catch (err) {
      console.error(err);
    }
  });

  function addAttachment(path, alt) {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    attachments.push({ id, path, alt });
    renderAttachments();
    renderRequirements(); // Re-render requirements to update toolbars
  }

  function removeAttachment(id) {
    attachments = attachments.filter(a => a.id !== id);
    // Also remove from any requirements
    requirements.forEach(req => {
      req.attachedImages = req.attachedImages.filter(img => img.id !== id);
    });
    renderAttachments();
    renderRequirements(); // Re-render requirements to update toolbars
  }

  function renderAttachments() {
    attachmentsListEl.innerHTML = '';
    
    if (attachments.length === 0) {
      attachmentsListEl.innerHTML = '<p style="color:#475569; font-size: 0.9rem; text-align:center;">등록된 첨부파일이 없습니다.</p>';
      return;
    }

    attachments.forEach((att, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'list-item';
      
      const contentEl = document.createElement('div');
      contentEl.className = 'list-item-content';
      
      const rowEl = document.createElement('div');
      rowEl.className = 'attachment-row';
      
      const nameCol = document.createElement('div');
      const nameLabel = document.createElement('label');
      nameLabel.textContent = `파일 경로 ${index + 1}`;
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = att.path;
      nameInput.readOnly = true;
      nameInput.style.background = '#f1f5f9';
      nameInput.style.color = '#475569';
      nameInput.style.cursor = 'not-allowed';
      
      nameCol.appendChild(nameLabel);
      nameCol.appendChild(nameInput);
      
      const altCol = document.createElement('div');
      const altLabel = document.createElement('label');
      altLabel.textContent = 'Alt 정보';
      const altInput = document.createElement('input');
      altInput.type = 'text';
      altInput.value = att.alt;
      altInput.placeholder = '예: 예약 화면 예시';
      altInput.addEventListener('input', (e) => {
        att.alt = e.target.value;
        renderRequirements(); // Update alt info in requirements list if selected
      });
      altCol.appendChild(altLabel);
      altCol.appendChild(altInput);
      
      rowEl.appendChild(nameCol);
      rowEl.appendChild(altCol);
      contentEl.appendChild(rowEl);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-small';
      deleteBtn.textContent = '삭제';
      deleteBtn.onclick = () => removeAttachment(att.id);
      
      itemEl.appendChild(contentEl);
      itemEl.appendChild(deleteBtn);
      
      attachmentsListEl.appendChild(itemEl);
    });
  }

  // Add Requirement Logic
  addReqBtn.addEventListener('click', () => {
    const newId = addRequirement('', '');
    setTimeout(() => {
      const newTitleInput = document.getElementById(`req-title-${newId}`);
      if (newTitleInput) {
        newTitleInput.focus();
      }
    }, 0);
  });

  function addRequirement(title, content) {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    requirements.push({ id, title, content, attachedImages: [] });
    renderRequirements();
    return id;
  }

  function removeRequirement(id) {
    requirements = requirements.filter(r => r.id !== id);
    renderRequirements();
  }

  function renderRequirements() {
    // Preserve focus and cursor position if possible
    const activeElementId = document.activeElement ? document.activeElement.id : null;
    let cursorPosition = null;
    if (activeElementId && document.activeElement.tagName === 'TEXTAREA') {
        cursorPosition = document.activeElement.selectionStart;
    }

    requirementsListEl.innerHTML = '';

    if (requirements.length === 0) {
      requirementsListEl.innerHTML = '<p style="color:#475569; font-size: 0.9rem; text-align:center;">등록된 요구사항이 없습니다.</p>';
      return;
    }

    requirements.forEach((req, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'list-item req-item';
      
      const headerEl = document.createElement('div');
      headerEl.className = 'req-item-header';
      headerEl.style.display = 'flex';
      headerEl.style.alignItems = 'center';
      
      const titlePrefix = document.createElement('span');
      titlePrefix.textContent = `### 3.${index + 1} `;
      titlePrefix.style.fontWeight = 'bold';
      titlePrefix.style.marginRight = '8px';
      titlePrefix.style.color = '#334155';
      titlePrefix.style.whiteSpace = 'nowrap';
      
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.value = req.title;
      titleInput.placeholder = '요구사항 세부 제목 (예: 작업내용)';
      titleInput.id = `req-title-${req.id}`;
      titleInput.addEventListener('input', (e) => {
        req.title = e.target.value;
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-small';
      deleteBtn.textContent = '삭제';
      deleteBtn.onclick = () => removeRequirement(req.id);
      
      headerEl.appendChild(titlePrefix);
      headerEl.appendChild(titleInput);
      headerEl.appendChild(deleteBtn);
      
      const bodyEl = document.createElement('div');
      bodyEl.className = 'req-item-body';
      
      const addHeaderBtn = document.createElement('button');
      addHeaderBtn.className = 'btn btn-secondary btn-small';
      addHeaderBtn.textContent = '헤더 추가';
      addHeaderBtn.style.marginBottom = '0.5rem';
      addHeaderBtn.onclick = () => {
         const regex = new RegExp(`#### 3\\.${index + 1}\\.(\\d+)`, 'g');
         let maxCount = 0;
         let match;
         while ((match = regex.exec(req.content)) !== null) {
            const num = parseInt(match[1], 10);
            if (num > maxCount) maxCount = num;
         }
         const nextNum = maxCount + 1;
         const headerText = `#### 3.${index + 1}.${nextNum} `;
         
         if (req.content && !req.content.endsWith('\n')) {
             req.content += '\n';
         }
         req.content += headerText;
         renderRequirements();
         
         setTimeout(() => {
           const ta = document.getElementById(`req-content-${req.id}`);
           if (ta) {
             ta.focus();
             ta.setSelectionRange(ta.value.length, ta.value.length);
           }
         }, 0);
      };
      
      bodyEl.appendChild(addHeaderBtn);
      
      const contentTextarea = document.createElement('textarea');
      contentTextarea.value = req.content;
      contentTextarea.placeholder = '요구사항 내용을 입력하세요...';
      contentTextarea.id = `req-content-${req.id}`;
      contentTextarea.style.minHeight = '200px';
      contentTextarea.addEventListener('input', (e) => {
        req.content = e.target.value;
      });
      
      // Toolbar for attachments
      const toolbarEl = document.createElement('div');
      toolbarEl.className = 'toolbar';
      if (attachments.length > 0) {
        const toolbarLabel = document.createElement('span');
        toolbarLabel.style.fontSize = '0.8rem';
        toolbarLabel.style.color = '#475569';
        toolbarLabel.style.marginRight = '0.5rem';
        toolbarLabel.textContent = '첨부 삽입:';
        toolbarEl.appendChild(toolbarLabel);
        
        attachments.forEach((att) => {
          const btn = document.createElement('button');
          btn.className = 'toolbar-btn';
          // Extract filename from path
          const filename = att.path.split(/[/\\]/).pop() || '파일';
          btn.textContent = filename;
          btn.title = att.alt || '';
          btn.onclick = () => {
            // Append to req.attachedImages instead of inserting text
            if (!req.attachedImages.some(img => img.id === att.id)) {
                req.attachedImages.push(att);
                renderRequirements();
            }
          };
          toolbarEl.appendChild(btn);
        });
      }
      
      bodyEl.appendChild(contentTextarea);
      bodyEl.appendChild(toolbarEl);

      // Display selected attachments for this requirement below the textarea
      if (req.attachedImages && req.attachedImages.length > 0) {
        const selectedImgsEl = document.createElement('div');
        selectedImgsEl.style.marginTop = '0.75rem';
        selectedImgsEl.style.padding = '0.75rem';
        selectedImgsEl.style.background = '#f1f5f9';
        selectedImgsEl.style.borderRadius = '8px';
        selectedImgsEl.style.border = '1px solid #e2e8f0';
        
        const selTitle = document.createElement('div');
        selTitle.textContent = '요구사항 첨부 이미지:';
        selTitle.style.fontSize = '0.85rem';
        selTitle.style.fontWeight = '500';
        selTitle.style.color = '#475569';
        selTitle.style.marginBottom = '0.5rem';
        selectedImgsEl.appendChild(selTitle);
        
        req.attachedImages.forEach((img, idx) => {
           // We reference the original attachment to get the latest alt text
           const currentAtt = attachments.find(a => a.id === img.id) || img;

           const row = document.createElement('div');
           row.style.display = 'flex';
           row.style.justifyContent = 'space-between';
           row.style.fontSize = '0.85rem';
           row.style.marginBottom = '0.25rem';
           row.style.color = '#1e293b';
           
           const info = document.createElement('span');
           const filename = currentAtt.path.split(/[/\\]/).pop();
           info.textContent = `- 첨부 이미지 ${idx + 1}: ${filename} (${currentAtt.alt || 'alt 없음'})`;
           
           const rmBtn = document.createElement('button');
           rmBtn.textContent = '✕';
           rmBtn.style.background = 'transparent';
           rmBtn.style.border = 'none';
           rmBtn.style.color = '#ef4444';
           rmBtn.style.cursor = 'pointer';
           rmBtn.style.padding = '0 0.5rem';
           rmBtn.onclick = () => {
              req.attachedImages.splice(idx, 1);
              renderRequirements();
           };
           
           row.appendChild(info);
           row.appendChild(rmBtn);
           selectedImgsEl.appendChild(row);
        });
        bodyEl.appendChild(selectedImgsEl);
      }
      
      itemEl.appendChild(headerEl);
      itemEl.appendChild(bodyEl);
      
      requirementsListEl.appendChild(itemEl);
    });

    // Restore focus if needed
    if (activeElementId) {
      const el = document.getElementById(activeElementId);
      if (el) {
        el.focus();
        if (cursorPosition !== null && el.tagName === 'TEXTAREA') {
          el.setSelectionRange(cursorPosition, cursorPosition);
        }
      }
    }
  }

  // Generate Markdown
  function generateMarkdown() {
    const title = document.getElementById('doc-title').value.trim();
    const overview = document.getElementById('doc-overview').value.trim();
    const role = document.getElementById('doc-role').value.trim();
    const categoryPath = document.getElementById('category-path').value.trim();

    let md = `---\n`;
    md += `title: ${title}\n`;
    if (categoryPath) {
      md += `category: ${categoryPath}\n`;
    }
    md += `attachments:\n`;
    attachments.forEach(att => {
      md += `  - path: ${att.path}\n`;
      md += `    alt: ${att.alt}\n`;
    });
    md += `---\n\n`;

    md += `# 작업 요청서\n`;
    md += `## 1. 개요\n`;
    md += `${overview}\n\n`;

    md += `## 2. 역할\n`;
    md += `${role}\n\n`;

    md += `## 3. 요구사항\n`;
    
    // Sub Requirements
    requirements.forEach((req, index) => {
      md += `### 3.${index + 1} ${req.title}\n`;
      if (req.content) {
        md += `${req.content}\n`;
      }

      // Append attached images to the end of the requirement block
      if (req.attachedImages && req.attachedImages.length > 0) {
        md += `\n`;
        req.attachedImages.forEach((img, imgIdx) => {
          const currentAtt = attachments.find(a => a.id === img.id) || img;
          md += `- 첨부 이미지 ${imgIdx + 1}: \`${currentAtt.alt}\`\n`;
        });
      }
      md += `\n`;
    });

    md += `## 4. 최종 결과물\n`;
    md += `아래 항목을 반드시 모두 포함해 주세요.\n`;
    md += `- **변경/생성한 파일 목록** (경로 포함)\n`;
    md += `- 컴파일/테스트 수행 여부 및 결과\n`;
    md += `- **요약문만 출력하지 마세요. 필수 항목 누락은 실패로 간주됩니다.**\n`;

    return md;
  }

  function showStatus(message, isError = false) {
    statusMessageEl.textContent = message;
    statusMessageEl.className = isError ? 'status-error' : 'status-success';
    setTimeout(() => {
      statusMessageEl.className = '';
      statusMessageEl.style.display = 'none';
    }, 5000);
  }

  // Save Event
  saveBtn.addEventListener('click', async () => {
    const mdContent = generateMarkdown();
    const filePath = document.getElementById('file-path').value.trim();
    const categoryPath = document.getElementById('category-path').value.trim();

    // Validation for category path
    if (categoryPath) {
      const parts = categoryPath.split('.');
      if (parts.some(p => p.trim() === '')) {
        alert('카테고리 경로가 올바르지 않습니다');
        return;
      }
    }

    const mappingFilePath = localStorage.getItem('mappingFilePath') || '';

    const images = attachments.map(att => ({
      path: att.path,
      alt: att.alt
    }));

    saveBtn.disabled = true;
    saveBtn.style.opacity = '0.7';

    try {
      const response = await window.api.saveMarkdown({ 
        filePath, 
        content: mdContent,
        categoryPath,
        mappingFilePath,
        images
      });
      if (response.success) {
        showStatus(`${response.message} (${response.filePath})`);
        document.getElementById('file-path').value = response.filePath; // Update path if selected via dialog
      } else {
        showStatus(`저장 실패: ${response.message}`, true);
      }
    } catch (error) {
      showStatus(`오류 발생: ${error.message}`, true);
    } finally {
      saveBtn.disabled = false;
      saveBtn.style.opacity = '1';
    }
  });

  // New and Open logic
  if (window.api && window.api.onFileNew) {
    window.api.onFileNew(() => {
      document.getElementById('doc-title').value = '';
      document.getElementById('doc-overview').value = '';
      document.getElementById('doc-role').value = '';
      document.getElementById('file-path').value = '';
      document.getElementById('category-path').value = '';
      attachments = [];
      requirements = [];
      addRequirement('', '');
      renderAttachments();
      renderRequirements();
    });
  }

  if (window.api && window.api.onFileOpen) {
    window.api.onFileOpen((data) => {
      const { filePath, content } = data;
      document.getElementById('file-path').value = filePath;
      
      // Clear current
      document.getElementById('doc-title').value = '';
      document.getElementById('doc-overview').value = '';
      document.getElementById('doc-role').value = '';
      document.getElementById('category-path').value = '';
      attachments = [];
      requirements = [];

      // 1. Frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const fm = frontmatterMatch[1];
        const titleMatch = fm.match(/title:\s*(.*)/);
        if (titleMatch) document.getElementById('doc-title').value = titleMatch[1].trim();

        const categoryMatch = fm.match(/category:\s*(.*)/);
        if (categoryMatch) {
          document.getElementById('category-path').value = categoryMatch[1].trim();
        }
        
        const attRegex = /-\s*path:\s*(.*)\n\s*alt:\s*(.*)/g;
        let match;
        while ((match = attRegex.exec(fm)) !== null) {
          const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
          attachments.push({ id, path: match[1].trim(), alt: match[2].trim() });
        }
      }
      
      // 2. Sections
      const overviewMatch = content.match(/## 1\. 개요\n([\s\S]*?)(?=\n## 2\. 역할)/);
      if (overviewMatch) document.getElementById('doc-overview').value = overviewMatch[1].trim();
      
      const roleMatch = content.match(/## 2\. 역할\n([\s\S]*?)(?=\n## 3\. 요구사항)/);
      if (roleMatch) document.getElementById('doc-role').value = roleMatch[1].trim();
      
      const reqSectionMatch = content.match(/## 3\. 요구사항\n([\s\S]*?)(?=\n## 4\. 최종 결과물)/);
      if (reqSectionMatch) {
        const reqText = reqSectionMatch[1];
        const reqs = reqText.split(/### 3\.\d+\s+/).filter(Boolean);
        reqs.forEach(reqBlock => {
           const lines = reqBlock.split('\n');
           const title = lines[0].trim();
           
           let contentLines = [];
           let attachedImages = [];
           
           for (let i = 1; i < lines.length; i++) {
             const line = lines[i];
             const imgMatch = line.match(/- 첨부 이미지 \d+:\s*(.*)/);
             if (imgMatch) {
                const altText = imgMatch[1].replace(/^`|`$/g, '').trim();
                const att = attachments.find(a => a.alt === altText);
                if (att) attachedImages.push(att);
             } else {
                contentLines.push(line);
             }
           }
           
           while (contentLines.length > 0 && contentLines[contentLines.length - 1].trim() === '') {
             contentLines.pop();
           }
           
           const contentStr = contentLines.join('\n').trim();
           const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
           requirements.push({ id, title, content: contentStr, attachedImages });
        });
      }
      
      if (requirements.length === 0) {
        addRequirement('', '');
      } else {
        renderAttachments();
        renderRequirements();
      }
    });
  }

  if (window.api && window.api.onOpenSettings) {
    window.api.onOpenSettings(() => {
      mappingFilePathInput.value = localStorage.getItem('mappingFilePath') || '';
      settingsModal.style.display = 'flex';
    });
  }
});
