document.addEventListener('DOMContentLoaded', () => {
	const notesSeparators = document.querySelectorAll('.mf-notes-separator');
	notesSeparators.forEach((separator) => {
		separator.remove();
	});

	const notes = document.querySelectorAll('.mf-notes');
	notes.forEach((note) => {
		(note as HTMLElement).style.display = 'none';
	});

	const createTooltip = (ref: HTMLAnchorElement) => {
		const tooltipId = ref.getAttribute('id')!.replace('mf-note-ref', 'mf-tooltip');
		const existingTooltip = document.getElementById(tooltipId);
		if (existingTooltip) return;
		const noteId = ref.getAttribute('data-note-id');
		if (!noteId) return;
		const noteElem = document.getElementById(noteId);
		if (!noteElem) return;

		const tooltip = document.createElement('div');
		tooltip.className = 'mf-tooltip';
		tooltip.setAttribute('id', tooltipId);
		tooltip.innerHTML = noteElem.innerHTML;

		document.body.appendChild(tooltip);
		requestAnimationFrame(() => {
			tooltip.classList.add('mf-tooltip-visible');
		});

		const rect = ref.getBoundingClientRect();
		const viewportMid = window.innerWidth / 2;
		tooltip.style.top = `${rect.top + window.scrollY}px`;
		if (rect.right > viewportMid) {
			tooltip.style.right = `${window.innerWidth - rect.left + window.scrollX + 8}px`;
		} else {
			tooltip.style.left = `${rect.right + window.scrollX + 8}px`;
		}
	};

	const removeTooltip = (ref: Element) => {
		const tooltip = document.getElementById(ref.getAttribute('id')!.replace('mf-note-ref', 'mf-tooltip'));
		if (!tooltip) return;

		tooltip.classList.remove('mf-tooltip-visible');
		tooltip.addEventListener('transitionend', () => {
			tooltip.remove();
		}, {once: true});
	};

	const noteRefs = document.querySelectorAll('.mf-note-ref');
	noteRefs.forEach((ref) => {
		const href = (ref as HTMLAnchorElement).getAttribute('href');
		if (href?.startsWith('#')) {
			ref.setAttribute('data-note-id', href.slice(1));
		}
		(ref as HTMLAnchorElement).removeAttribute('href');
		ref.addEventListener('click', (e) => {
			e.preventDefault();
		});
		ref.classList.add('mf-note-ref-hoverable');

		ref.addEventListener('mouseover', () => {
			createTooltip(ref as HTMLAnchorElement);
		});
		ref.addEventListener('mousemove', () => {
			createTooltip(ref as HTMLAnchorElement);
		});
		ref.addEventListener('mouseout', () => {
			removeTooltip(ref);
		});
	});
});
