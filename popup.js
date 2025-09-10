// popup.js for EnquiryID Logger

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const siteInput = document.getElementById('site-input');
  const addSiteBtn = document.getElementById('add-site');
  const siteList = document.getElementById('site-list');
  const monitoringStatus = document.getElementById('monitoring-status');

  const paramInput = document.getElementById('param-input');
  const addParamBtn = document.getElementById('add-param');
  const paramList = document.getElementById('param-list');
  const paramStatus = document.getElementById('param-status');

  const parameterLogTbody = document.getElementById('parameter-log-tbody');
  const exportWithFiltersCheckbox = document.getElementById('export-with-filters');
  const clearLogsBtn = document.getElementById('clear-logs');
  const forceCaptureBtn = document.getElementById('force-capture');
  const statusText = document.getElementById('status-text');

  const searchInput = document.getElementById('search-input');
  const paramFilterHeader = document.getElementById('param-filter-header');
  const paramFilterText = document.getElementById('param-filter-text');
  const paramFilterOptions = document.getElementById('param-filter-options');
  let selectedParams = new Set(); // Store selected parameter names
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const exportDropdown = document.getElementById('export-dropdown');

  const urlParamCheckbox = document.getElementById('url-param-checkbox');
  const domSelectorInput = document.getElementById('dom-selector-input');

  // Initialize default enquiryid parameter
  initializeDefaultEnquiryId();

  // Handle URL parameter checkbox change
  urlParamCheckbox.addEventListener('change', () => {
    const isUrlParam = urlParamCheckbox.checked;
    const selectorGroup = document.getElementById('selector-group');

    if (isUrlParam) {
      domSelectorInput.value = ''; // Clear selector when URL param is selected
      selectorGroup.style.display = 'none';
    } else {
      selectorGroup.style.display = 'block';
    }
  });

  // Initialize checkbox state on load
  urlParamCheckbox.dispatchEvent(new Event('change'));


  // Load sites, parameters and parameter logs
  loadSites();
  loadParameters();
  initializeMultiselect();
  loadParameterLogs();

  // Check extension status
  checkExtensionStatus();

  // Add site
  addSiteBtn.addEventListener('click', () => {
    const site = siteInput.value.trim();
    if (site) {
      // Validate site input
      if (site.length > 100) {
        alert('Site name is too long. Please enter a shorter name.');
        return;
      }
      
      // Basic validation for site format
      if (!/^[a-zA-Z0-9.-]+$/.test(site)) {
        alert('Please enter a valid site name (letters, numbers, dots, and hyphens only).');
        return;
      }
      
      chrome.storage.local.get(['monitoredSites'], data => {
        const sites = data.monitoredSites || [];
        if (!sites.includes(site)) {
          sites.push(site);
          chrome.storage.local.set({ monitoredSites: sites }, () => {
            if (chrome.runtime.lastError) {
              console.error('Failed to save site:', chrome.runtime.lastError);
              alert('Failed to add site. Please try again.');
            } else {
              loadSites();
              refreshExtension();
            }
          });
        } else {
          alert('Site is already in the monitoring list.');
        }
      });
      siteInput.value = '';
    } else {
      alert('Please enter a site name.');
    }
  });

  // Add parameter
  addParamBtn.addEventListener('click', () => {
    const paramName = paramInput.value.trim().toLowerCase();
    const isUrlParam = urlParamCheckbox.checked;
    const selector = isUrlParam ? null : domSelectorInput.value.trim(); // Only read selector if not URL param

    if (!paramName) {
      alert('Please enter a parameter name.');
      return;
    }

    // Validate parameter name
    if (paramName.length > 50) {
      alert('Parameter name is too long. Please enter a shorter name.');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(paramName)) {
      alert('Please enter a valid parameter name (letters, numbers, hyphens, and underscores only).');
      return;
    }

    // Validate selector for DOM parameters
    if (!isUrlParam && (!selector || selector.trim().length === 0)) {
      alert('Please enter a CSS selector for DOM parameters.');
      return;
    }

    chrome.storage.local.get(['monitoredParams'], data => {
      const params = data.monitoredParams || [];

      // Check if parameter name already exists
      if (params.some(p => p.paramName === paramName)) {
        alert('Parameter name already exists.');
        return;
      }

      const newParam = {
        paramName: paramName,
        isUrlParam: isUrlParam,
        selector: isUrlParam ? null : selector
      };

      params.push(newParam);

      chrome.storage.local.set({ monitoredParams: params }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save parameter:', chrome.runtime.lastError);
          alert('Failed to add parameter. Please try again.');
        } else {
          loadParameters();
          loadParameterLogs(); // Refresh grid after parameter addition
          refreshExtension();
          // Clear inputs
          paramInput.value = '';
          domSelectorInput.value = '';
          urlParamCheckbox.checked = true;
        }
      });
    });
  });


  // Search and filter functionality
  searchInput.addEventListener('input', () => {
    loadParameterLogs();
  });

  // Multiselect parameter filter events
  paramFilterHeader.addEventListener('click', () => {
    const container = paramFilterHeader.parentElement;
    const isOpen = paramFilterOptions.style.display !== 'none';

    if (isOpen) {
      paramFilterOptions.style.display = 'none';
      container.classList.remove('open');
    } else {
      paramFilterOptions.style.display = 'block';
      container.classList.add('open');
    }
  });


  dateFrom.addEventListener('change', () => {
    loadParameterLogs();
  });

  dateTo.addEventListener('change', () => {
    loadParameterLogs();
  });

  clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    selectedParams.clear();
    const selectElement = document.getElementById('param-filter-select');
    if (selectElement) {
      selectElement.value = ''; // Select "All Parameters"
    }
    dateFrom.value = '';
    dateTo.value = '';
    updateParamFilterText();
    loadParameterLogs();
  });

  // Export dropdown handler
  exportDropdown.addEventListener('change', async () => {
    const exportType = exportDropdown.value;

    if (exportType === 'json') {
      chrome.storage.local.get(['enquiryData'], async (data) => {
        try {
          const exportData = await getExportData(data.enquiryData);
          if (exportData.length === 0) {
            alert('No data to export');
            return;
          }
          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
          downloadBlob(blob, 'enquiry_data.json');
      } catch (error) {
        console.error('Error exporting JSON:', error);
        alert('Failed to export JSON. Please try again.');
      }
    });
    } else if (exportType === 'csv') {
      chrome.storage.local.get(['enquiryData'], async (data) => {
        try {
          const exportData = await getExportData(data.enquiryData);

          // Create CSV headers dynamically based on data
          if (exportData.length === 0) {
            alert('No data to export');
            return;
          }

          const headers = Object.keys(exportData[0]);
          const csv = headers.join(',') + '\n' +
            exportData.map(row =>
              headers.map(header => {
                const value = row[header] || '';
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                  return '"' + value.replace(/"/g, '""') + '"';
                }
                return value;
              }).join(',')
          ).join('\n');

          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          downloadBlob(blob, 'enquiry_data.csv');
      } catch (error) {
        console.error('Error exporting CSV:', error);
        alert('Failed to export CSV. Please try again.');
        }
      });
    } else if (exportType === 'excel') {
      chrome.storage.local.get(['enquiryData'], async (data) => {
        try {
          const exportData = await getExportData(data.enquiryData);

          // Create CSV headers dynamically based on data
          if (exportData.length === 0) {
            alert('No data to export');
            return;
          }

          const headers = Object.keys(exportData[0]);
          // Create Excel-compatible CSV with BOM for proper encoding
          const csv = '\ufeff' + headers.join(',') + '\n' +
            exportData.map(row =>
              headers.map(header => {
                const value = row[header] || '';
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                  return '"' + value.replace(/"/g, '""') + '"';
                }
                return value;
              }).join(',')
            ).join('\n');

          const blob = new Blob([csv], {
            type: 'application/vnd.ms-excel;charset=utf-8'
          });
          downloadBlob(blob, 'enquiry_data.xlsx');
        } catch (error) {
          console.error('Error exporting Excel:', error);
          alert('Failed to export Excel file. Please try again.');
        }
      });
    }

    // Reset dropdown to default state
    exportDropdown.value = '';
  });


  // Force capture DOM parameters
  forceCaptureBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'forceCapture' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to send force capture message:', chrome.runtime.lastError);
            alert('Failed to trigger DOM capture. Make sure you\'re on a monitored website.');
          } else {
            alert('DOM capture triggered! Check the grid in a few seconds.');
            // Refresh the logs after a short delay
            setTimeout(() => loadParameterLogs(), 2000);
          }
        });
      } else {
        alert('No active tab found.');
      }
    });
  });

  // Clear logs
  clearLogsBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all enquiry data?')) {
      chrome.storage.local.set({ enquiryData: {} }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to clear enquiry data:', chrome.runtime.lastError);
          alert('Failed to clear enquiry data. Please try again.');
        } else {
          loadParameterLogs();
        }
      });
    }
  });

  // Initialize default enquiryid parameter
  function initializeDefaultEnquiryId() {
    chrome.storage.local.get(['monitoredParams'], data => {
      const params = data.monitoredParams || [];

      // Check if enquiryid already exists as a URL parameter
      const enquiryIdExists = params.some(p => p.paramName === 'enquiryid' && p.isUrlParam);

      if (!enquiryIdExists) {
        // Add enquiryid as a URL parameter
        const enquiryIdParam = {
          paramName: 'enquiryid',
          isUrlParam: true,
          selector: null
        };

        params.push(enquiryIdParam);

        chrome.storage.local.set({ monitoredParams: params }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to initialize enquiryid:', chrome.runtime.lastError);
          }
        });
      }
    });
  }

  // Helpers
  function loadSites() {
    chrome.storage.local.get(['monitoredSites'], data => {
      try {
        const sites = data.monitoredSites || [];
        siteList.innerHTML = '';
        sites.forEach(site => {
          const li = document.createElement('li');
          li.textContent = site;
          const removeBtn = document.createElement('button');
          removeBtn.textContent = 'Remove';
          removeBtn.style.marginLeft = '10px';
          removeBtn.style.padding = '2px 8px';
          removeBtn.style.fontSize = '10px';
          removeBtn.addEventListener('click', () => {
            const newSites = sites.filter(s => s !== site);
            chrome.storage.local.set({ monitoredSites: newSites }, () => {
              if (chrome.runtime.lastError) {
                console.error('Failed to remove site:', chrome.runtime.lastError);
                alert('Failed to remove site. Please try again.');
              } else {
                loadSites();
                refreshExtension();
              }
            });
          });
          li.appendChild(removeBtn);
          siteList.appendChild(li);
        });
        updateMonitoringStatus();
      } catch (error) {
        console.error('Error loading sites:', error);
      }
    });
  }

  function updateMonitoringStatus() {
    chrome.storage.local.get(['monitoredSites'], data => {
      try {
        const sites = data.monitoredSites || [];
        if (sites.length === 0) {
          monitoringStatus.textContent = 'No sites monitored - extension is inactive';
          monitoringStatus.style.color = '#f44336';
        } else {
          monitoringStatus.textContent = `Monitoring ${sites.length} site(s): ${sites.join(', ')}`;
          monitoringStatus.style.color = '#4CAF50';
        }
      } catch (error) {
        console.error('Error updating monitoring status:', error);
      }
    });
  }

  function loadParameters() {
    chrome.storage.local.get(['monitoredParams'], data => {
      try {
        const params = data.monitoredParams || [];
        paramList.innerHTML = '';

        params.forEach((param, index) => {
          const li = document.createElement('li');

          // Create parameter name span
          const paramNameSpan = document.createElement('span');
          paramNameSpan.textContent = param.paramName;
          paramNameSpan.style.fontWeight = 'bold';
          paramNameSpan.style.color = '#2196F3';

          // Create parameter type badge
          const typeBadge = document.createElement('span');
          typeBadge.textContent = param.isUrlParam ? 'URL' : 'DOM';
          typeBadge.style.backgroundColor = param.isUrlParam ? '#4CAF50' : '#FF9800';
          typeBadge.style.color = 'white';
          typeBadge.style.padding = '2px 6px';
          typeBadge.style.borderRadius = '3px';
          typeBadge.style.fontSize = '10px';
          typeBadge.style.marginLeft = '8px';

          // Create selector info if DOM parameter
          const selectorInfo = document.createElement('span');
          if (!param.isUrlParam && param.selector) {
            selectorInfo.textContent = param.selector;
            selectorInfo.style.color = '#666';
            selectorInfo.style.fontSize = '11px';
            selectorInfo.style.marginLeft = '8px';
            selectorInfo.style.fontStyle = 'italic';
          }

          // Add elements to list item
          li.appendChild(paramNameSpan);
          li.appendChild(typeBadge);
          if (!param.isUrlParam && param.selector) {
            li.appendChild(selectorInfo);
          }

          const removeBtn = document.createElement('button');
          removeBtn.textContent = '×';
          removeBtn.title = 'Remove parameter';
          removeBtn.style.marginLeft = 'auto';
          removeBtn.style.padding = '2px 6px';
          removeBtn.style.fontSize = '12px';
          removeBtn.style.border = 'none';
          removeBtn.style.borderRadius = '50%';
          removeBtn.style.width = '20px';
          removeBtn.style.height = '20px';
          removeBtn.style.cursor = 'pointer';
          removeBtn.style.backgroundColor = '#f44336';
          removeBtn.style.color = 'white';
          removeBtn.style.display = 'flex';
          removeBtn.style.alignItems = 'center';
          removeBtn.style.justifyContent = 'center';

          // Don't allow removing enquiryid (it's always required)
          if (param.paramName !== 'enquiryid') {
            removeBtn.addEventListener('click', () => {
              const newParams = params.filter((_, i) => i !== index);
              chrome.storage.local.set({ monitoredParams: newParams }, () => {
                if (chrome.runtime.lastError) {
                  console.error('Failed to remove parameter:', chrome.runtime.lastError);
                  alert('Failed to remove parameter. Please try again.');
                } else {
                  loadParameters();
                  loadParameterLogs(); // Refresh grid after parameter removal
                  refreshExtension();
                }
              });
            });
          } else {
            // Hide remove button for enquiryid
            removeBtn.style.display = 'none';
          }

          li.appendChild(removeBtn);
          paramList.appendChild(li);
        });
        updateParameterStatus();
      } catch (error) {
        console.error('Error loading parameters:', error);
      }
    });
  }

  function updateParameterStatus() {
    chrome.storage.local.get(['monitoredParams'], data => {
      try {
        const params = data.monitoredParams || [];
        if (params.length === 0) {
          paramStatus.textContent = 'No parameters configured';
        } else {
          const urlParams = params.filter(p => p.isUrlParam).length;
          const domParams = params.filter(p => !p.isUrlParam).length;
          paramStatus.textContent = `Monitoring ${params.length} parameters (${urlParams} URL, ${domParams} DOM)`;
        }
      } catch (error) {
        console.error('Error updating parameter status:', error);
      }
    });
  }

  function refreshExtension() {
    // Only reload tabs that match monitored sites
    chrome.storage.local.get(['monitoredSites'], data => {
      const monitoredSites = data.monitoredSites || [];
      
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && tab.url.startsWith('http')) {
            try {
              const urlObj = new URL(tab.url);
              const hostname = urlObj.hostname;
              
              // Only reload if the tab's site is in the monitored list
              if (monitoredSites.some(site => hostname.includes(site))) {
                chrome.tabs.reload(tab.id);
              }
            } catch (error) {
              console.error('Error checking tab URL:', error);
            }
          }
        });
      });
    });
  }

  function loadParameterLogs() {
    chrome.storage.local.get(['enquiryData'], data => {
      try {
        const enquiryData = data.enquiryData || {};
        parameterLogTbody.innerHTML = '';

        // Get filter values
        const searchTerm = searchInput.value.toLowerCase().trim();
        const fromDate = dateFrom.value ? new Date(dateFrom.value) : null;
        const toDate = dateTo.value ? new Date(dateTo.value + 'T23:59:59') : null;

        // Filter enquiry data
        let filteredEnquiries = Object.entries(enquiryData).filter(([enquiryId, enquiry]) => {
          // Search filter
          if (searchTerm) {
            const searchInEnquiryId = enquiryId.toLowerCase().includes(searchTerm);
            const searchInUrl = enquiry.url && enquiry.url.toLowerCase().includes(searchTerm);
            const searchInParameters = enquiry.parameters &&
              Object.values(enquiry.parameters).some(param =>
                param.value && param.value.toString().toLowerCase().includes(searchTerm)
              );

            if (!searchInEnquiryId && !searchInUrl && !searchInParameters) {
              return false;
            }
          }

          // Parameter filter (single select - filters enquiries that have the selected configured parameter)
          if (selectedParams.size > 0) {
            const selectedParam = Array.from(selectedParams)[0];
            if (selectedParam !== 'enquiryid' && (!enquiry.parameters || !enquiry.parameters[selectedParam])) {
              return false;
            }
          }

          // Date range filter
          const enquiryDate = new Date(enquiry.lastUpdated);
          if (fromDate && enquiryDate < fromDate) {
            return false;
          }
          if (toDate && enquiryDate > toDate) {
            return false;
          }

          return true;
        });

        // Get ONLY configured parameters from monitoredParams
        chrome.storage.local.get(['monitoredParams'], (configData) => {
          const monitoredParams = configData.monitoredParams || [];
          const monitoredParamNames = new Set();

          // Always include enquiryId (it's always configured as URL parameter)
          monitoredParamNames.add('enquiryid');

          // Add configured parameter names
          monitoredParams.forEach(param => {
            monitoredParamNames.add(param.paramName.toLowerCase());
          });

          // Convert to sorted array
          const sortedParamNames = Array.from(monitoredParamNames).sort();

          // Update parameter filter options (ONLY configured parameters)
          updateParameterFilterOptions(sortedParamNames, []);

          // Create table header with dynamic columns (ONLY configured parameters)
          createTableHeader(sortedParamNames);

          // Sort enquiries by last updated (newest first) and take first 50
          const sortedEnquiries = filteredEnquiries
            .sort(([, a], [, b]) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
            .slice(0, 50);

          // Create rows for each enquiry
          sortedEnquiries.forEach(([enquiryId, enquiry]) => {
          const row = document.createElement('tr');
          
            // Time cell (last updated)
            const timeCell = document.createElement('td');
            const lastUpdated = new Date(enquiry.lastUpdated);
            const formattedTime = lastUpdated.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
            });
            timeCell.textContent = formattedTime;
            timeCell.title = `First seen: ${new Date(enquiry.firstSeen).toISOString()}\nLast updated: ${enquiry.lastUpdated}`;
            timeCell.className = 'time-column';
            row.appendChild(timeCell);

            // Parameter cells - for ALL parameters in the data
            sortedParamNames.forEach(paramName => {
              const paramCell = document.createElement('td');
              paramCell.className = 'parameter-column';

              // Special handling for enquiryid column
              if (paramName === 'enquiryid') {
                // Create a link for enquiryid
                const link = document.createElement('a');
                link.href = enquiry.url || '#';
                link.target = '_blank';
                link.textContent = enquiryId;
                link.className = 'enquiryid-link';
                link.title = `Click to open: ${enquiry.url || 'No URL available'}`;

                // Add hover tooltip with additional information
                link.setAttribute('data-tooltip', `Enquiry ID: ${enquiryId}\nURL: ${enquiry.url || 'Not available'}\nFirst seen: ${new Date(enquiry.firstSeen).toLocaleString()}\nLast updated: ${new Date(enquiry.lastUpdated).toLocaleString()}`);

                paramCell.appendChild(link);
                paramCell.classList.add('url-param', 'enquiryid-cell');
              } else if (enquiry.parameters && enquiry.parameters[paramName]) {
                const paramData = enquiry.parameters[paramName];

                // Add source indicator class
                if (paramData.source === 'DOM') {
                  paramCell.classList.add('dom-param');
                } else {
                  paramCell.classList.add('url-param');
                }

                // Handle both single values (URL params) and arrays (DOM params)
                let displayValues = [];
                let fullTitle = '';

                if (paramData.value && Array.isArray(paramData.value)) {
                  // DOM parameter with multiple values
                  displayValues = paramData.value.filter(v => v && v.length > 0);
                  fullTitle = `Values: ${paramData.value.map(v => '"' + (v || 'empty') + '"').join(', ')}\nElements found: ${paramData.elementsFound}\nSelector: ${paramData.selector}\nSource: ${paramData.source}\nLast updated: ${paramData.lastUpdated}`;
                } else if (paramData.value && typeof paramData.value === 'string') {
                  // URL parameter with single value
                  displayValues = paramData.value ? [paramData.value] : [];
                  fullTitle = `${paramData.value || 'Empty'}\nSource: ${paramData.source}\nLast updated: ${paramData.lastUpdated}`;
                }

                if (displayValues.length > 0) {
                  // Create clickable link to URL
                  const paramLink = document.createElement('a');
                  paramLink.href = enquiry.url;
                  paramLink.target = '_blank';
                  paramLink.style.color = '#0066cc';
                  paramLink.style.textDecoration = 'underline';

                  // Display multiple values
                  if (displayValues.length === 1) {
                    paramLink.textContent = displayValues[0];
                  } else if (displayValues.length === 2) {
                    paramLink.textContent = `${displayValues[0]}, ${displayValues[1]}`;
                  } else if (displayValues.length === 3) {
                    paramLink.textContent = `${displayValues[0]}, ${displayValues[1]}, ${displayValues[2]}`;
                  } else {
                    // Show first 2 values and indicate there are more
                    paramLink.textContent = `${displayValues[0]}, ${displayValues[1]} (+${displayValues.length - 2} more)`;
                  }

                  paramLink.title = fullTitle;
                  paramCell.appendChild(paramLink);
                } else {
                  // Empty values
                  paramCell.textContent = '(empty)';
                  paramCell.style.color = '#999';
                  paramCell.title = fullTitle;
                }
              } else {
                // No data available for this parameter
                paramCell.textContent = '-';
                paramCell.style.color = '#999';
                paramCell.title = `No ${paramName} data available for enquiry ${enquiryId}`;
              }

              row.appendChild(paramCell);
            });

            parameterLogTbody.appendChild(row);
          });

          // If no data, create a placeholder row to show all parameters
          if (sortedEnquiries.length === 0 && sortedParamNames.length > 0) {
            const currentTime = new Date();
            const placeholderRow = document.createElement('tr');

            // Time cell with current time
          const timeCell = document.createElement('td');
            const formattedTime = currentTime.toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            });
            timeCell.textContent = formattedTime + ' (current)';
            timeCell.title = 'Current time - no enquiry data captured yet';
            timeCell.style.fontStyle = 'italic';
            timeCell.className = 'time-column';
            placeholderRow.appendChild(timeCell);

            // Parameter cells - all empty for all parameters
            sortedParamNames.forEach(paramName => {
              const paramCell = document.createElement('td');
              paramCell.className = 'parameter-column';
              paramCell.textContent = '-';
              paramCell.style.color = '#999';
              paramCell.title = `${paramName} - not captured yet`;
              placeholderRow.appendChild(paramCell);
            });

            parameterLogTbody.appendChild(placeholderRow);
          } else if (sortedEnquiries.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = sortedParamNames.length + 1; // +1 for time column
            emptyCell.textContent = 'No enquiry data available';
            emptyCell.style.textAlign = 'center';
            emptyCell.style.padding = '20px';
            emptyCell.style.color = '#666';
            emptyRow.appendChild(emptyCell);
            parameterLogTbody.appendChild(emptyRow);
          }
        });

      } catch (error) {
        console.error('Error loading parameter logs:', error);
      }
    });
  }

  function createTableHeader(paramNames) {
    const thead = document.getElementById('parameter-log-thead');
    const headerRow = thead.querySelector('tr');

    // Clear existing parameter columns (keep time column)
    while (headerRow.children.length > 1) {
      headerRow.removeChild(headerRow.lastChild);
    }

    // Add parameter columns
    paramNames.forEach(paramName => {
      const th = document.createElement('th');
      th.className = 'parameter-column';
      th.textContent = paramName;
      headerRow.appendChild(th);
    });
  }

  function updateParameterFilterOptions(monitoredParamNames, dummyData) {
    try {
      // Use ONLY configured parameter names from monitoredParams
      const paramNames = new Set(monitoredParamNames);

      // Clear existing options
      paramFilterOptions.innerHTML = '';

      // Create select dropdown
      const selectElement = document.createElement('select');
      selectElement.id = 'param-filter-select';
      selectElement.style.width = '100%';
      selectElement.style.padding = '5px';
      selectElement.style.border = '1px solid #ccc';
      selectElement.style.borderRadius = '3px';

      // Add "All Parameters" option
      const allOption = document.createElement('option');
      allOption.value = '';
      allOption.textContent = 'All Parameters';
      selectElement.appendChild(allOption);

      // Add parameter options (include enquiryid this time)
      Array.from(paramNames).sort().forEach(paramName => {
        const option = document.createElement('option');
        option.value = paramName;
        option.textContent = paramName;
        selectElement.appendChild(option);
      });

      paramFilterOptions.appendChild(selectElement);

      // Add event listener for select change
      selectElement.addEventListener('change', () => {
        const selectedValue = selectElement.value;
        if (selectedValue === '') {
          // All Parameters selected
          selectedParams.clear();
        } else {
          // Single parameter selected
          selectedParams.clear();
          selectedParams.add(selectedValue);
        }
        updateParamFilterText();
        loadParameterLogs();
      });

      // Set initial selection to "All Parameters"
      selectElement.value = '';
      selectedParams.clear();
    } catch (error) {
      console.error('Error updating parameter filter options:', error);
    }
  }

  function updateParamFilterText() {
    const selectElement = document.getElementById('param-filter-select');
    if (selectElement) {
      const selectedValue = selectElement.value;
      if (selectedValue === '') {
        paramFilterText.textContent = 'All Parameters';
      } else {
        paramFilterText.textContent = selectedValue;
      }
    } else {
      paramFilterText.textContent = 'All Parameters';
    }
  }

  function initializeMultiselect() {
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!paramFilterHeader.contains(e.target) && !paramFilterOptions.contains(e.target)) {
        paramFilterOptions.style.display = 'none';
        paramFilterHeader.parentElement.classList.remove('open');
      }
    });
  }

  function checkExtensionStatus() {
    // Check if we can communicate with background script
    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus('Error: Background script not available', 'error');
        return;
      }

      updateStatus('Background: OK', 'ready');

      // Check if we can communicate with content script on current tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'status' }, (contentResponse) => {
            if (chrome.runtime.lastError) {
              updateStatus('Content: Not injected', 'warning');
            } else if (contentResponse && contentResponse.status === 'active') {
              updateStatus('Content: Active', 'ready');
            } else {
              updateStatus('Content: Inactive', 'warning');
            }
          });
        } else {
          updateStatus('No active tab', 'warning');
        }
      });
    });

    // Check stored data
    chrome.storage.local.get(['parameterLogs', 'monitoredSites', 'domSelectors'], (data) => {
      const logsCount = data.parameterLogs ? Object.keys(data.parameterLogs).length : 0;
      const sitesCount = data.monitoredSites ? data.monitoredSites.length : 0;
      const selectorsCount = data.domSelectors ? data.domSelectors.filter(s => s.enabled).length : 0;

      if (logsCount === 0 && (sitesCount === 0 || selectorsCount === 0)) {
        updateStatus('No data configured', 'warning');
      } else if (logsCount > 0) {
        updateStatus('Data available', 'ready');
      } else {
        updateStatus('Configuration OK, no data yet', 'ready');
      }
    });
  }

  function updateStatus(message, statusClass) {
    statusText.textContent = message;
    statusText.className = statusClass || '';
  }





  function getExportData(enquiryData) {
    return new Promise((resolve) => {
      try {
        // Get configured parameters to determine grid columns
        chrome.storage.local.get(['monitoredParams'], (configData) => {
          const monitoredParams = configData.monitoredParams || [];
          const gridColumns = new Set(['timestamp', 'enquiryid', 'url']); // Always include time, enquiryId, and URL

          // Add configured parameter names as grid columns
          monitoredParams.forEach(param => {
            gridColumns.add(param.paramName.toLowerCase());
          });

          // Apply filters if checkbox is checked
          let filteredEnquiries = Object.entries(enquiryData || {});
          if (exportWithFiltersCheckbox.checked) {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const fromDate = dateFrom.value ? new Date(dateFrom.value) : null;
            const toDate = dateTo.value ? new Date(dateTo.value + 'T23:59:59') : null;

            filteredEnquiries = filteredEnquiries.filter(([enquiryId, enquiry]) => {
              // Search filter
              if (searchTerm) {
                const searchInEnquiryId = enquiryId.toLowerCase().includes(searchTerm);
                const searchInUrl = enquiry.url && enquiry.url.toLowerCase().includes(searchTerm);
                const searchInParameters = enquiry.parameters &&
                  Object.values(enquiry.parameters).some(param =>
                    param.value && param.value.toString().toLowerCase().includes(searchTerm)
                  );

                if (!searchInEnquiryId && !searchInUrl && !searchInParameters) {
                  return false;
                }
              }

              // Parameter filter (single select - filters enquiries that have the selected configured parameter)
              if (selectedParams.size > 0) {
                const selectedParam = Array.from(selectedParams)[0];
                if (selectedParam !== 'enquiryid' && (!enquiry.parameters || !enquiry.parameters[selectedParam])) {
                  return false;
                }
              }

              // Date range filter
              const enquiryDate = new Date(enquiry.lastUpdated);
              if (fromDate && enquiryDate < fromDate) {
                return false;
              }
              if (toDate && enquiryDate > toDate) {
                return false;
              }

              return true;
            });
          }

          // Convert enquiry data to grid-like export format (only grid-visible columns)
          const exportArray = [];
          filteredEnquiries.forEach(([enquiryId, enquiry]) => {
            const rowData = {};

            // Add columns in grid order
            Array.from(gridColumns).sort().forEach(columnName => {
              if (columnName === 'timestamp') {
                // Format timestamp like grid display
                rowData['Time (Local)'] = new Date(enquiry.lastUpdated).toLocaleString();
              } else if (columnName === 'enquiryid') {
                rowData['enquiryid'] = enquiryId;
              } else if (columnName === 'url') {
                rowData['url'] = enquiry.url || '';
              } else {
                // Add parameter value if it exists, otherwise show empty
                if (enquiry.parameters && enquiry.parameters[columnName]) {
                  const paramData = enquiry.parameters[columnName];
                  if (paramData.value && Array.isArray(paramData.value)) {
                    // DOM parameter with multiple values - join like grid display
                    rowData[columnName] = paramData.value.join('; ');
                  } else if (paramData.value && typeof paramData.value === 'string') {
                    // URL parameter with single value
                    rowData[columnName] = paramData.value;
                  } else {
                    // Empty parameter
                    rowData[columnName] = '(empty)';
                  }
                } else {
                  // Parameter not found in this enquiry
                  rowData[columnName] = '(empty)';
                }
              }
            });

            exportArray.push(rowData);
          });

          // Sort by last updated (most recent first)
          const sortedExport = exportArray.sort((a, b) => {
            const dateA = new Date(a['Time (Local)']);
            const dateB = new Date(b['Time (Local)']);
            return dateB - dateA;
          });

          resolve(sortedExport);
        });
      } catch (error) {
        console.error('Error getting export data:', error);
        resolve([]);
      }
    });
  }

  function downloadBlob(blob, filename) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    }
  }
}); 