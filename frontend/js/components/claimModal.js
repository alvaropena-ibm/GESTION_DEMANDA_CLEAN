// Claim Modal Component

/**
 * Open claim modal
 */
export function openClaimModal() {
    const modal = document.getElementById('claimModal');
    if (modal) {
        // Reset form
        const form = document.getElementById('claimForm');
        if (form) {
            form.reset();
        }
        document.getElementById('claimId').value = '';
        
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('claimDate');
        if (dateInput) {
            dateInput.value = today;
        }
        
        // Restore title for creation mode
        const modalTitle = modal.querySelector('h2');
        if (modalTitle) {
            modalTitle.textContent = '➕ Nueva Imputación';
        }
        
        // Load projects dropdown
        loadProjectsForClaim();
        
        // Load modules dropdown based on user team
        loadModulesForClaim();
        
        // Show modal
        modal.style.display = 'flex';
        modal.classList.add('active');
        
        console.log('Claim modal opened');
    } else {
        console.error('Claim modal not found');
    }
}

/**
 * Close claim modal
 */
export function closeClaimModal() {
    const modal = document.getElementById('claimModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

/**
 * Load projects for dropdown
 */
async function loadProjectsForClaim() {
    try {
        // Get authentication tokens - support both Cognito and IAM
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            console.error('No authentication tokens found');
            return;
        }

        const response = await fetch('https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/projects', {
            headers: {
                'Authorization': authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey,
                'x-user-team': userTeam
            }
        });

        if (response.ok) {
            const data = await response.json();
            const projects = data.data?.projects || data.projects || [];
            
            const select = document.getElementById('claimProjectId');
            if (select) {
                select.innerHTML = '<option value="">-- Seleccionar Proyecto --</option>';
                
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.id;
                    option.textContent = `${project.code} - ${project.title}`;
                    select.appendChild(option);
                });
                
                console.log(`Loaded ${projects.length} projects for claim modal`);
            }
        }
    } catch (error) {
        console.error('Error loading projects for claim:', error);
    }
}

/**
 * Load modules for claim based on user team from app_config
 */
async function loadModulesForClaim() {
    try {
        // Get authentication tokens - support both Cognito and IAM
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            console.error('No authentication tokens found');
            return;
        }

        console.log(`📦 Cargando módulos para el equipo: ${userTeam}`);

        // Llamar al endpoint con los query parameters correctos
        const response = await fetch(`https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/config?key=modules&team=${encodeURIComponent(userTeam)}`, {
            headers: {
                'Authorization': authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey,
                'x-user-team': userTeam
            }
        });

        const select = document.getElementById('claimModule');
        if (!select) {
            console.error('Module select element not found');
            return;
        }

        // Limpiar opciones existentes
        select.innerHTML = '<option value="">-- Seleccionar Módulo --</option>';

        if (response.ok) {
            const data = await response.json();
            console.log('📦 Respuesta del servidor:', data);
            
            // El endpoint devuelve { key, value, type, team, description }
            const configValue = data.data?.value || data.value;
            
            if (configValue && Array.isArray(configValue)) {
                configValue.forEach(module => {
                    const option = document.createElement('option');
                    option.value = module;
                    option.textContent = module;
                    select.appendChild(option);
                });
                
                console.log(`✅ Cargados ${configValue.length} módulos para el equipo ${userTeam}`);
            } else {
                console.log(`⚠️ No hay módulos configurados para el equipo ${userTeam}`);
            }
        } else if (response.status === 404) {
            console.log(`ℹ️ No se encontró configuración de módulos para el equipo ${userTeam}`);
        } else {
            console.error('Error loading config:', response.status, await response.text());
        }
    } catch (error) {
        console.error('Error loading modules for claim:', error);
    }
}

/**
 * Load tasks for selected project (tries concept tasks first, then assignments)
 */
async function loadTasksForProject(projectId) {
    try {
        // Get authentication tokens - support both Cognito and IAM
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        
        if (!awsAccessKey || !userTeam) {
            console.error('No authentication tokens found');
            return;
        }

        // Try to fetch concept tasks first
        const conceptResponse = await fetch(`https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/concept-tasks?projectId=${projectId}`, {
            headers: {
                'Authorization': authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey,
                'x-user-team': userTeam
            }
        });

        let projectTasks = [];
        let source = '';

        if (conceptResponse.ok) {
            const data = await conceptResponse.json();
            console.log('🔍 Concept tasks API response:', data);
            
            // Try different response structures
            let conceptTasks = [];
            if (data.data?.tasks) {
                conceptTasks = data.data.tasks;
            } else if (data.data?.conceptTasks) {
                conceptTasks = data.data.conceptTasks;
            } else if (data.tasks) {
                conceptTasks = data.tasks;
            } else if (data.conceptTasks) {
                conceptTasks = data.conceptTasks;
            } else if (Array.isArray(data.data)) {
                conceptTasks = data.data;
            } else if (Array.isArray(data)) {
                conceptTasks = data;
            }
            
            console.log(`🔍 Found ${conceptTasks.length} concept tasks in response`);
            
            // Filter tasks for this specific project (project_id field variations)
            if (Array.isArray(conceptTasks) && conceptTasks.length > 0) {
                projectTasks = conceptTasks.filter(t => {
                    const taskProjectId = t.project_id || t.projectId || t.project?.id;
                    return taskProjectId === projectId;
                });
                
                console.log(`🔍 After filtering: ${projectTasks.length} tasks for project ${projectId}`);
            }
            
            if (projectTasks.length > 0) {
                source = 'concept_tasks';
                console.log(`✅ Loaded ${projectTasks.length} concept tasks for project`);
            }
        } else {
            console.error('❌ Concept tasks API failed:', conceptResponse.status, conceptResponse.statusText);
        }

        // If no concept tasks found, try assignments as fallback
        if (projectTasks.length === 0) {
            const assignmentsResponse = await fetch('https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/assignments', {
                headers: {
                    'Authorization': authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey,
                    'x-user-team': userTeam
                }
            });

            if (assignmentsResponse.ok) {
                const data = await assignmentsResponse.json();
                const allAssignments = data.data?.assignments || data.assignments || [];
                
                // Filter assignments for this project
                const projectAssignments = allAssignments.filter(a => 
                    a.project_id === projectId || a.projectId === projectId
                );
                
                // Get unique tasks by title
                const uniqueTasks = new Map();
                projectAssignments.forEach(assignment => {
                    const title = assignment.title;
                    if (!uniqueTasks.has(title)) {
                        uniqueTasks.set(title, {
                            title: title,
                            description: assignment.description || '',
                            hours: null
                        });
                    }
                });
                
                projectTasks = Array.from(uniqueTasks.values());
                source = 'assignments';
                console.log(`✅ Loaded ${projectTasks.length} tasks from assignments (no concept tasks found)`);
            }
        }
        
        const taskSelect = document.getElementById('claimTaskSelect');
        const taskSelectGroup = document.getElementById('claimTaskSelectGroup');
        
        if (projectTasks.length > 0) {
            // Show task selector
            taskSelect.innerHTML = '<option value="">-- Seleccionar tarea o escribir nueva abajo --</option>';
            
            // Sort tasks alphabetically by title
            projectTasks.sort((a, b) => a.title.localeCompare(b.title));
            
            projectTasks.forEach(task => {
                const option = document.createElement('option');
                option.value = task.title;
                option.setAttribute('data-description', task.description || '');
                option.setAttribute('data-source', source);
                
                // Show title with hours estimate if available
                let optionText = task.title;
                if (task.hours) {
                    optionText += ` (${task.hours}h)`;
                }
                
                option.textContent = optionText;
                taskSelect.appendChild(option);
            });
            
            taskSelectGroup.style.display = 'block';
        } else {
            // Hide task selector if no tasks found in either source
            taskSelectGroup.style.display = 'none';
            console.log(`⚠️ No tasks found for project ${projectId} in either concept_tasks or assignments`);
        }
    } catch (error) {
        console.error('Error loading tasks for project:', error);
        const taskSelectGroup = document.getElementById('claimTaskSelectGroup');
        if (taskSelectGroup) {
            taskSelectGroup.style.display = 'none';
        }
    }
}

/**
 * Handle task selection - autofill fields
 */
function handleTaskSelection() {
    const taskSelect = document.getElementById('claimTaskSelect');
    const selectedTitle = taskSelect.value;
    
    if (selectedTitle) {
        // Autofill task title
        document.getElementById('claimTaskTitle').value = selectedTitle;
        
        // Autofill description if available
        const selectedOption = taskSelect.options[taskSelect.selectedIndex];
        const description = selectedOption.getAttribute('data-description');
        if (description) {
            document.getElementById('claimTaskDescription').value = description;
        }
        
        console.log('Task selected and fields autofilled:', selectedTitle);
    }
}

/**
 * Save claim (create or update)
 */
export async function saveClaim() {
    const form = document.getElementById('claimForm');
    
    if (!form || !form.checkValidity()) {
        if (form) {
            form.reportValidity();
        }
        return;
    }

    // Get authentication tokens - support both Cognito and IAM
    const authType = sessionStorage.getItem('auth_type');
    let awsAccessKey;
    
    if (authType === 'cognito') {
        awsAccessKey = sessionStorage.getItem('cognito_access_token');
    } else {
        awsAccessKey = sessionStorage.getItem('aws_access_key');
    }
    
    const userTeam = sessionStorage.getItem('user_team');
    const userFullName = sessionStorage.getItem('user_full_name');
    const userEmail = sessionStorage.getItem('user_email');
    
    if (!awsAccessKey || !userTeam) {
        alert('❌ No se encontraron credenciales de autenticación');
        return;
    }

    // Detectar si es edición o creación
    const timeEntryId = document.getElementById('claimId').value;
    const isEdit = !!timeEntryId;

    const timeEntryData = {
        workDate: document.getElementById('claimDate').value,
        taskTitle: document.getElementById('claimTaskTitle').value,
        taskDescription: document.getElementById('claimTaskDescription').value || '',
        activity: document.getElementById('claimActivity').value,
        hours: parseFloat(document.getElementById('claimHours').value),
        module: document.getElementById('claimModule').value || null
    };

    // Solo enviar estos campos en creación
    if (!isEdit) {
        if (!userFullName) {
            alert('❌ No se encontró el nombre del usuario. Por favor, vuelve a iniciar sesión.');
            return;
        }
        timeEntryData.projectId = document.getElementById('claimProjectId').value;
        timeEntryData.resourceName = userFullName;
        timeEntryData.resourceEmail = userEmail || null;
    }

    console.log(isEdit ? '✏️ Actualizando imputación:' : '💾 Creando imputación:', timeEntryData);
    
    try {
        const url = isEdit 
            ? `https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/time-entries/${timeEntryId}`
            : 'https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/time-entries';

        const response = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey,
                'x-user-team': userTeam
            },
            body: JSON.stringify(timeEntryData)
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Operación exitosa:', result);
            
            let message = isEdit 
                ? '✅ Imputación actualizada exitosamente' 
                : '✅ Imputación creada exitosamente';
                
            if (!isEdit && result.data?.resourceCreated) {
                message += '\n\n✨ Se ha creado automáticamente tu perfil de recurso.';
            }
            
            alert(message);
            closeClaimModal();
            
            // Reload time entries table
            if (typeof window.loadTimeEntries === 'function') {
                window.loadTimeEntries();
            }
        } else {
            console.error('❌ Error en la operación:', result);
            const errorMsg = result.error?.message || result.message || 'Error desconocido';
            alert(`❌ Error al ${isEdit ? 'actualizar' : 'guardar'} la imputación:\n${errorMsg}`);
        }
    } catch (error) {
        console.error('❌ Error de red:', error);
        alert(`❌ Error de conexión:\n${error.message}\n\nVerifica tu conexión a internet.`);
    }
}

// Global variables to store all time entries and pagination state
let allUserTimeEntries = [];
let filteredTimeEntries = [];
let currentClaimPage = 1;
const claimEntriesPerPage = 10;

/**
 * Load time entries for current user
 */
export async function loadTimeEntries() {
    try {
        // Get authentication tokens - support both Cognito and IAM
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');
        const userFullName = sessionStorage.getItem('user_full_name');
        
        if (!awsAccessKey || !userTeam || !userFullName) {
            console.error('Missing authentication data');
            return;
        }

        console.log('📥 Cargando imputaciones para:', userFullName);

        const response = await fetch('https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/time-entries', {
            headers: {
                'Authorization': authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey,
                'x-user-team': userTeam
            }
        });

        if (response.ok) {
            const data = await response.json();
            const allTimeEntries = data.data?.timeEntries || data.timeEntries || [];
            
            // Filtrar solo las imputaciones del usuario actual
            allUserTimeEntries = allTimeEntries.filter(entry => 
                entry.resource?.name === userFullName
            );
            
            console.log(`✅ Cargadas ${allUserTimeEntries.length} imputaciones de ${allTimeEntries.length} totales`);
            
            // Reset to first page and apply filters
            currentClaimPage = 1;
            applyFilters();
        } else {
            console.error('Error loading time entries:', response.status);
            allUserTimeEntries = [];
            filteredTimeEntries = [];
            renderTimeEntriesTable([]);
            updatePaginationInfo();
        }
    } catch (error) {
        console.error('Error loading time entries:', error);
        allUserTimeEntries = [];
        filteredTimeEntries = [];
        renderTimeEntriesTable([]);
        updatePaginationInfo();
    }
}

/**
 * Apply filters to time entries
 */
function applyFilters() {
    const searchInput = document.getElementById('claim-search');
    
    let entries = [...allUserTimeEntries];
    
    // Filtro por texto (ID Proyecto, Título Proyecto, Título Tarea, Actividad, Módulo, Fecha)
    if (searchInput && searchInput.value.trim()) {
        const searchText = searchInput.value.trim();
        
        // Detectar si el texto es una fecha en formato DD/MM/YYYY
        const datePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const dateMatch = searchText.match(datePattern);
        
        if (dateMatch) {
            // Es una fecha en formato DD/MM/YYYY
            const [, day, month, year] = dateMatch;
            const searchDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`; // Convertir a YYYY-MM-DD
            
            entries = entries.filter(entry => {
                const entryDate = entry.workDate ? entry.workDate.split('T')[0] : '';
                return entryDate === searchDate;
            });
            
            console.log(`🔍 Búsqueda por fecha: ${searchDate}`);
        } else {
            // Búsqueda normal por texto
            const searchLower = searchText.toLowerCase();
            entries = entries.filter(entry => {
                const projectCode = (entry.project?.code || entry.projectId || '').toLowerCase();
                const projectTitle = (entry.project?.title || '').toLowerCase();
                const taskTitle = (entry.taskTitle || '').toLowerCase();
                const activity = (entry.activity || '').toLowerCase();
                const module = (entry.module || '').toLowerCase();
                
                // También buscar en la fecha formateada (DD/MM/YYYY)
                const formattedDate = formatDate(entry.workDate);
                
                return projectCode.includes(searchLower) || 
                       projectTitle.includes(searchLower) || 
                       taskTitle.includes(searchLower) ||
                       activity.includes(searchLower) ||
                       module.includes(searchLower) ||
                       formattedDate.includes(searchText); // Búsqueda exacta en fecha formateada
            });
        }
    }
    
    console.log(`🔍 Filtros aplicados: ${entries.length} de ${allUserTimeEntries.length} imputaciones`);
    
    filteredTimeEntries = entries;
    currentClaimPage = 1; // Reset to first page when filters change
    renderCurrentClaimPage();
    updateTotalHours(filteredTimeEntries);
}

/**
 * Render current page of time entries
 */
function renderCurrentClaimPage() {
    const startIndex = (currentClaimPage - 1) * claimEntriesPerPage;
    const endIndex = startIndex + claimEntriesPerPage;
    const pageEntries = filteredTimeEntries.slice(startIndex, endIndex);
    
    renderTimeEntriesTable(pageEntries);
    updatePaginationInfo();
}

/**
 * Update pagination information and controls
 */
function updatePaginationInfo() {
    const totalEntries = filteredTimeEntries.length;
    const totalPages = Math.ceil(totalEntries / claimEntriesPerPage);
    const startIndex = totalEntries === 0 ? 0 : (currentClaimPage - 1) * claimEntriesPerPage + 1;
    const endIndex = Math.min(currentClaimPage * claimEntriesPerPage, totalEntries);
    
    // Update info text
    const infoText = document.getElementById('claim-info-text');
    if (infoText) {
        infoText.textContent = `Showing ${startIndex}-${endIndex} of ${totalEntries} entries`;
    }
    
    // Update page number
    const currentPageSpan = document.getElementById('claim-current-page');
    if (currentPageSpan) {
        currentPageSpan.textContent = `Page ${currentClaimPage} of ${totalPages || 1}`;
    }
    
    // Update button states
    const prevBtn = document.getElementById('claim-prev-btn');
    const nextBtn = document.getElementById('claim-next-btn');
    
    if (prevBtn) {
        prevBtn.disabled = currentClaimPage === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentClaimPage >= totalPages || totalPages === 0;
    }
}

/**
 * Load previous page
 */
function loadPreviousClaimPage() {
    if (currentClaimPage > 1) {
        currentClaimPage--;
        renderCurrentClaimPage();
    }
}

/**
 * Load next page
 */
function loadNextClaimPage() {
    const totalPages = Math.ceil(filteredTimeEntries.length / claimEntriesPerPage);
    if (currentClaimPage < totalPages) {
        currentClaimPage++;
        renderCurrentClaimPage();
    }
}

/**
 * Render time entries in table
 */
function renderTimeEntriesTable(timeEntries) {
    const tbody = document.getElementById('claim-table-body');
    
    if (!tbody) {
        console.error('Table body not found');
        return;
    }

    if (timeEntries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2rem; color: #718096;">
                    No hay imputaciones registradas. Haz clic en "Nueva Imputación" para comenzar.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = timeEntries.map(entry => `
        <tr>
            <td style="font-size: 0.875rem;">${entry.project?.code || entry.projectId}</td>
            <td style="font-weight: 500;">${entry.project?.title || 'Sin título'}</td>
            <td>${entry.taskTitle}</td>
            <td style="font-size: 0.875rem; color: #718096;">${entry.taskDescription || '-'}</td>
            <td>
                <span style="padding: 0.25rem 0.75rem; background: #e6fffa; color: #319795; border-radius: 0.25rem; font-size: 0.875rem;">
                    ${entry.activity}
                </span>
            </td>
            <td style="text-align: center;">${formatDate(entry.workDate)}</td>
            <td style="text-align: center; font-weight: 600; color: #319795;">${entry.hours}h</td>
            <td>${entry.module || '-'}</td>
            <td style="text-align: center;">
                <button onclick="editTimeEntry('${entry.id}')" style="padding: 0.5rem; background: none; border: none; color: #4299e1; cursor: pointer;" title="Editar">
                    ✏️
                </button>
                <button onclick="deleteTimeEntry('${entry.id}')" style="padding: 0.5rem; background: none; border: none; color: #e53e3e; cursor: pointer;" title="Eliminar">
                    🗑️
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Update total hours statistics
 */
function updateTotalHours(timeEntries) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get today's date (start and end of day)
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    // Get week boundaries (Monday to Sunday)
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Calculate totals
    let monthTotal = 0;
    let weekTotal = 0;
    let todayTotal = 0;

    timeEntries.forEach(entry => {
        const entryDate = new Date(entry.workDate);
        const hours = parseFloat(entry.hours) || 0;

        // Month total
        if (entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear) {
            monthTotal += hours;
        }

        // Week total
        if (entryDate >= monday && entryDate <= sunday) {
            weekTotal += hours;
        }

        // Today total
        if (entryDate >= today && entryDate <= todayEnd) {
            todayTotal += hours;
        }
    });

    // Update UI
    const monthElement = document.getElementById('claim-total-month');
    const weekElement = document.getElementById('claim-total-week');
    const todayElement = document.getElementById('claim-total-today');

    if (monthElement) {
        monthElement.textContent = `${monthTotal.toFixed(1)}h`;
    }

    if (weekElement) {
        weekElement.textContent = `${weekTotal.toFixed(1)}h`;
    }

    if (todayElement) {
        todayElement.textContent = `${todayTotal.toFixed(1)}h`;
    }
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Edit time entry
 */
async function editTimeEntry(id) {
    try {
        const awsAccessKey = sessionStorage.getItem('aws_access_key');
        const userTeam = sessionStorage.getItem('user_team');

        // Buscar la entrada en los datos cargados
        const entry = allUserTimeEntries.find(e => e.id === id);
        
        if (!entry) {
            alert('❌ No se encontró la imputación');
            return;
        }

        console.log('✏️ Editando imputación:', entry);

        // Abrir modal
        const modal = document.getElementById('claimModal');
        if (!modal) {
            alert('❌ No se pudo abrir el modal');
            return;
        }

        // Cargar proyectos y módulos primero
        await loadProjectsForClaim();
        await loadModulesForClaim();

        // Precargar datos en el formulario
        document.getElementById('claimId').value = entry.id;
        document.getElementById('claimProjectId').value = entry.projectId;
        document.getElementById('claimDate').value = entry.workDate.split('T')[0];
        document.getElementById('claimTaskTitle').value = entry.taskTitle;
        document.getElementById('claimTaskDescription').value = entry.taskDescription || '';
        document.getElementById('claimActivity').value = entry.activity;
        document.getElementById('claimHours').value = entry.hours;
        document.getElementById('claimModule').value = entry.module || '';

        // Cargar tareas del proyecto si es posible
        if (entry.projectId) {
            await loadTasksForProject(entry.projectId);
        }

        // Cambiar título del modal
        const modalTitle = modal.querySelector('h2');
        if (modalTitle) {
            modalTitle.textContent = '✏️ Editar Imputación';
        }

        // Mostrar modal
        modal.style.display = 'flex';
        modal.classList.add('active');

    } catch (error) {
        console.error('Error al editar imputación:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

/**
 * Delete time entry
 */
async function deleteTimeEntry(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta imputación?')) {
        return;
    }

    try {
        // Get authentication tokens - support both Cognito and IAM
        const authType = sessionStorage.getItem('auth_type');
        let awsAccessKey;
        
        if (authType === 'cognito') {
            awsAccessKey = sessionStorage.getItem('cognito_access_token');
        } else {
            awsAccessKey = sessionStorage.getItem('aws_access_key');
        }
        
        const userTeam = sessionStorage.getItem('user_team');

        const response = await fetch(`https://xrqo2gedpl.execute-api.eu-west-1.amazonaws.com/prod/time-entries/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': authType === 'cognito' ? `Bearer ${awsAccessKey}` : awsAccessKey,
                'x-user-team': userTeam
            }
        });

        if (response.ok) {
            alert('✅ Imputación eliminada exitosamente');
            loadTimeEntries(); // Recargar tabla
        } else {
            const result = await response.json();
            alert(`❌ Error al eliminar: ${result.error?.message || result.message || 'Error desconocido'}`);
        }
    } catch (error) {
        console.error('Error deleting time entry:', error);
        alert(`❌ Error de conexión: ${error.message}`);
    }
}


/**
 * Initialize claim modal
 */
export function initializeClaimModal() {
    const addClaimBtn = document.getElementById('add-claim-btn');
    
    if (addClaimBtn) {
        addClaimBtn.addEventListener('click', openClaimModal);
        console.log('✅ Claim modal: Add button listener attached');
    } else {
        console.warn('⚠️ Claim modal: Add button not found');
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('claimModal');
    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeClaimModal();
            }
        });
        console.log('✅ Claim modal: Click outside listener attached');
    }
    
    // Event listener for project selection - load tasks
    const projectSelect = document.getElementById('claimProjectId');
    if (projectSelect) {
        projectSelect.addEventListener('change', function() {
            const projectId = this.value;
            if (projectId) {
                loadTasksForProject(projectId);
            } else {
                // Hide task selector if no project selected
                const taskSelectGroup = document.getElementById('claimTaskSelectGroup');
                if (taskSelectGroup) {
                    taskSelectGroup.style.display = 'none';
                }
            }
        });
        console.log('✅ Claim modal: Project selector listener attached');
    }
    
    // Event listener for task selection - autofill fields
    const taskSelect = document.getElementById('claimTaskSelect');
    if (taskSelect) {
        taskSelect.addEventListener('change', handleTaskSelection);
        console.log('✅ Claim modal: Task selector listener attached');
    }
    
    // Event listeners for filters
    const searchInput = document.getElementById('claim-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            applyFilters();
        });
        console.log('✅ Claim modal: Search filter listener attached');
    }
    
    const dateFilter = document.getElementById('claim-date-filter');
    if (dateFilter) {
        dateFilter.addEventListener('change', function() {
            applyFilters();
        });
        console.log('✅ Claim modal: Date filter listener attached');
    }
    
    // Make functions globally available for onclick handlers
    window.openClaimModal = openClaimModal;
    window.closeClaimModal = closeClaimModal;
    window.saveClaim = saveClaim;
    window.loadTimeEntries = loadTimeEntries;
    window.editTimeEntry = editTimeEntry;
    window.deleteTimeEntry = deleteTimeEntry;
    window.applyFilters = applyFilters;
    window.loadPreviousClaimPage = loadPreviousClaimPage;
    window.loadNextClaimPage = loadNextClaimPage;
    
    // Load time entries when module initializes
    console.log('✅ Claim modal: Loading initial time entries...');
    loadTimeEntries();
}
